import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, AlertCircle, Loader2 } from "lucide-react";
import { Modal } from "./ui/Modal";
import { addClient, getClients } from "../services/client-service";
import { addLoan } from "../services/loan-service";
import { Timestamp } from "firebase/firestore";


interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Define the shape of our row data
type ExcelRow = Record<string, unknown>;

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLog([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // 1. Convert to array of arrays to find header row (using unknown instead of any)
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      let headerRowIndex = -1;
      
      // Look for "TITULAR" in first 10 rows
      for(let i = 0; i < Math.min(rawRows.length, 10); i++) {
          const row = rawRows[i];
          if (Array.isArray(row)) {
              // Check if any cell in this row contains "TITULAR"
              const found = row.some((cell) => 
                  typeof cell === 'string' && cell.toUpperCase().trim() === "TITULAR"
              );
              if (found) {
                  headerRowIndex = i;
                  break;
              }
          }
      }

      if (headerRowIndex === -1) {
          addToLog("ERRO: Não encontrei a coluna 'TITULAR' nas primeiras 10 linhas.");
          setIsProcessing(false);
          return;
      }

      addToLog(`Cabeçalho encontrado na linha ${headerRowIndex + 1}.`);

      // 2. Re-parse using the found header row
      // range: headerRowIndex tells sheet_to_json to start parsing from there
      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, { range: headerRowIndex, defval: "" });

      if (jsonData.length === 0) {
        addToLog("ERRO: Nenhuma linha de dados encontrada após o cabeçalho.");
        setIsProcessing(false);
        return;
      }

      // Debug Headers
      const firstRow = jsonData[0];
      const headers = Object.keys(firstRow);
      addToLog(`Colunas: ${headers.join(", ")}`);


      addToLog(`Lendo ${jsonData.length} linhas...`);

      // 1. Load existing clients
      const existingClients = await getClients();
      
      let successCount = 0;
      let errorCount = 0;
      let importedTotalSum = 0;

      for (const row of jsonData) {
        try {
            // Helper to get value case-insensitive
            const getValue = (key: string): unknown => {
                const foundKey = Object.keys(row).find(k => k.trim().toUpperCase() === key.toUpperCase());
                return foundKey ? row[foundKey] : undefined;
            };

            const nameRaw = getValue("TITULAR");
            const name = typeof nameRaw === 'string' ? nameRaw.trim().toUpperCase() : "";
            
            if (!name) {
                // addToLog("Linha sem titular ignorada.");
                continue; 
            }

            const amountVal = getValue("VALORES");
            const amount = typeof amountVal === 'number' ? amountVal : parseCurrency(amountVal);

            const interestVal = getValue("VALOR DO JUROS");
            const interestValue = typeof interestVal === 'number' ? interestVal : parseCurrency(interestVal);
            
            const totalVal = getValue("TOTAL");
            const totalAmount = typeof totalVal === 'number' ? totalVal : parseCurrency(totalVal);
            
            const loanDate = parseExcelDate(getValue("DATA DO EMPRESTIMO"));
            const dueDate = parseExcelDate(getValue("DATA DO VENCIMENTO"));

            if (!amount || !loanDate) {
                 errorCount++;
                 addToLog(`Dados inválidos para: ${name}`);
                 continue;
            }


            // Calculate Rate
            const rate = amount > 0 ? (interestValue / amount) * 100 : 0;
            const termDays = Math.floor((dueDate.getTime() - loanDate.getTime()) / (1000 * 3600 * 24));

            const finalTotal = totalAmount || (amount + interestValue);
            importedTotalSum += finalTotal; // track sum

            // Find or Create Client
            let clientId = existingClients.find(c => c.name.toUpperCase() === name)?.id;
            
            if (!clientId) {
                addToLog(`Criando cliente: ${name}`);
                clientId = await addClient({ name, phone: "", cpf: "", address: "" });
                // Add to local cache to avoid re-creating in this loop
                existingClients.push({ id: clientId, name, phone: "", cpf: "", address: "" });
            }

            // Create Loan
            await addLoan({
                clientId: clientId!,
                clientName: name,
                loanDate: Timestamp.fromDate(loanDate),
                amount,
                dueDate: Timestamp.fromDate(dueDate),
                termDays: termDays > 0 ? termDays : 0,
                interestRate: parseFloat(rate.toFixed(2)),
                interestValue,
                totalAmount: finalTotal,
                status: 'pending' // Default to pending
            });
            
            successCount++;

        } catch (err) {
            console.error("Row error", err);
            errorCount++;
        }
      }

      addToLog(`Concluído! ${successCount} importados, ${errorCount} erros.`);
      addToLog(`Soma Total Importada: ${importedTotalSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
      
      if (successCount > 0) {
        setTimeout(() => {
            onSuccess();
            onClose();
        }, 3500); // Increased timeout to let user read the log
      } else {
        addToLog("⚠️ Nada importado. Verifique os nomes das colunas acima.");
      }

    } catch (error) {
      console.error("Import error", error);
      
      let errorMsg = "";
      if (error instanceof Error) {
          errorMsg = error.message;
      }
      
      if (errorMsg.includes("password") || errorMsg.includes("encrypted")) {
          addToLog("ERRO: Arquivo protegido por senha.");
          alert("Este arquivo está protegido por senha. Remova a senha no Excel e tente novamente.");
      } else {
          addToLog("Erro crítico ao importar arquivo.");
          alert("Erro ao ler o arquivo. Verifique se é um Excel válido.");
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addToLog = (msg: string) => {
      setLog(prev => [...prev, msg]);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !isProcessing && onClose()} title="Importar Planilha (Excel)">
      <div className="space-y-6">
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-100 transition-colors">
            {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="text-slate-600 font-medium">Processando planilha...</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 relative cursor-pointer">
                    <Upload className="text-slate-400" size={40} />
                    <div>
                        <p className="text-slate-700 font-medium">Clique para selecionar</p>
                        <p className="text-xs text-slate-500 mt-1">Arquivos .xlsx</p>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx, .xls"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
            )}
        </div>

        {/* Log Area */}
        {log.length > 0 && (
            <div className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono h-40 overflow-y-auto space-y-1">
                {log.map((l, i) => (
                    <div key={i}>{l}</div>
                ))}
            </div>
        )}

        <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm flex gap-2 items-start">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>
                A planilha deve ter colunas com os cabeçalhos exatos: 
                <strong> TITULAR, VALORES, DATA DO EMPRESTIMO, DATA DO VENCIMENTO, VALOR DO JUROS, TOTAL</strong>.
            </p>
        </div>
      </div>
    </Modal>
  );
}

// Helpers
function parseCurrency(val: unknown): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove R$, spaces, dots, replace comma with dot
    // Ex: "R$ 1.200,50" -> "1200.50"
    if (typeof val === 'string') {
        const clean = val.replace(/[^0-9,-]+/g, "").replace(",", ".");
        return parseFloat(clean) || 0;
    }
    return 0;
}

function parseExcelDate(val: unknown): Date {
    // If Excel serial number (days since 1900)
    if (typeof val === 'number') {
        const utcDate = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
    }
    
    // If string "DD/MM/YYYY"
    if (typeof val === 'string') {
        const parts = val.split("/");
        if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }
    
    return new Date(); // Fallback today
}
