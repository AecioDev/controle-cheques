import { useEffect, useState, useMemo } from "react";
import { Plus, Search, CheckCircle, Upload, ChevronLeft, ChevronRight, Edit2, Calendar, RotateCcw } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { getLoans, addLoan, updateLoan, type Loan } from "../services/loan-service";
import { getClients, type Client } from "../services/client-service";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth-context";
import { ImportModal } from "../components/ImportModal";
import { Timestamp, deleteField } from "firebase/firestore";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Editing State
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState("");
  const [documentNumber, setDocumentNumber] = useState(""); // New Field
  const [amount, setAmount] = useState("");
  const [loanDate, setLoanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [interestRate, setInterestRate] = useState("1.2"); // Default 1.2%
  
  // Payment Logic in Edit Modal
  const [paymentDate, setPaymentDate] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedYear]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [loansData, clientsData] = await Promise.all([getLoans(), getClients()]);
      setLoans(loansData);
      setClients(clientsData);
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Initial Logic for Edit or New
  function handleOpenModal(loan?: Loan) {
      if (loan) {
          setEditingLoan(loan);
          setSelectedClientId(loan.clientId);
          setDocumentNumber(loan.documentNumber || "");
          setAmount(loan.amount.toString());
          setInterestRate(loan.interestRate.toString());
          
          if (loan.loanDate?.seconds) {
              setLoanDate(format(new Date(loan.loanDate.seconds * 1000), "yyyy-MM-dd"));
          }
          if (loan.dueDate?.seconds) {
              setDueDate(format(new Date(loan.dueDate.seconds * 1000), "yyyy-MM-dd"));
          }
          
          // Payment Date default to Today if not set
          if (loan.paymentDate?.seconds) {
               setPaymentDate(format(new Date(loan.paymentDate.seconds * 1000), "yyyy-MM-dd"));
          } else {
               setPaymentDate(format(new Date(), "yyyy-MM-dd"));
          }

      } else {
          setEditingLoan(null);
          resetForm();
      }
      setIsModalOpen(true);
  }

  // Calculated Values
  const calculations = useMemo(() => {
    const valAmount = parseFloat(amount) || 0;
    const valRate = parseFloat(interestRate) || 0;
    
    let days = 0;
    if (loanDate && dueDate) {
      days = differenceInDays(new Date(dueDate), new Date(loanDate));
    }
    
    const valInterest = valAmount * (valRate / 100);
    const valTotal = valAmount + valInterest;

    return {
      days: days > 0 ? days : 0,
      interest: valInterest,
      total: valTotal
    };
  }, [amount, loanDate, dueDate, interestRate]);

  // Handle Date Change -> Suggest Due Date
  const handleLoanDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setLoanDate(newDate);
    if (!dueDate && newDate && !editingLoan) {
        setDueDate(format(addDays(new Date(newDate), 30), "yyyy-MM-dd"));
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !amount || !dueDate) return;

    setIsSubmitting(true);
    try {
      const client = clients.find(c => c.id === selectedClientId);
      
      const commonData = {
        clientId: selectedClientId,
        clientName: client?.name || "Unknown",
        documentNumber,
        loanDate: Timestamp.fromDate(new Date(loanDate)),
        amount: parseFloat(amount),
        dueDate: Timestamp.fromDate(new Date(dueDate)),
        termDays: calculations.days,
        interestRate: parseFloat(interestRate),
        interestValue: calculations.interest,
        totalAmount: calculations.total,
      };

      if (editingLoan) {
          // Status handles separately
          await updateLoan(editingLoan.id!, {
              ...commonData,
              status: editingLoan.status 
          });
      } else {
          await addLoan({
            ...commonData,
            status: 'pending'
          });
      }
      
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving loan", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkAsPaid() {
      if (!editingLoan || !paymentDate) return;
      // Removed confirmation as requested
      
      setIsSubmitting(true);
      try {
          await updateLoan(editingLoan.id!, {
              status: 'paid',
              paymentDate: Timestamp.fromDate(new Date(paymentDate))
          });
          setIsModalOpen(false);
          loadData();
      } catch (error) {
           console.error("Error marking as paid", error);
      } finally {
          setIsSubmitting(false);
      }
  }

  async function handleReversePayment() {
    if (!editingLoan) return;
    if (!confirm("Tem certeza que deseja estornar este pagamento?")) return;

    setIsSubmitting(true);
    try {
        await updateLoan(editingLoan.id!, {
            status: 'pending',
            paymentDate: deleteField() as unknown as Timestamp
        });
        setIsModalOpen(false);
        loadData();
    } catch (error) {
         console.error("Error reversing payment", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedClientId("");
    setDocumentNumber("");
    setAmount("");
    setDueDate("");
    setLoanDate(format(new Date(), "yyyy-MM-dd"));
    setEditingLoan(null);
  }

  // Extract available years from loans + current year
  const availableYears = useMemo(() => {
      const years = new Set([currentYear.toString()]);
      loans.forEach(l => {
          if (l.loanDate?.seconds) {
              years.add(new Date(l.loanDate.seconds * 1000).getFullYear().toString());
          }
      });
      return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [loans, currentYear]);

  const filteredLoans = loans.filter(l => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = l.clientName.toLowerCase().includes(searchLower) || 
                          (l.documentNumber && l.documentNumber.toLowerCase().includes(searchLower));
    
    // Year Filter
    let matchesYear = true;
    if (selectedYear !== "all") {
        if (l.loanDate?.seconds) {
            const loanYear = new Date(l.loanDate.seconds * 1000).getFullYear().toString();
            matchesYear = loanYear === selectedYear;
        } else {
            matchesYear = false;
        }
    }

    return matchesSearch && matchesYear;
  });

  const showImportButton = isAdmin && searchTerm.trim().toLowerCase() === "importar_agora";

  // Pagination Logic
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLoans = filteredLoans.slice(startIndex, startIndex + itemsPerPage);

  // Stats Calculations
  const totalPortfolio = filteredLoans.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalReceived = filteredLoans
    .filter(l => l.status === 'paid')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalPending = totalPortfolio - totalReceived;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm font-medium text-slate-500">Total a Receber (Geral)</p>
          <h2 className="text-2xl font-bold text-slate-900">
            {totalPortfolio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h2>
        </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm font-medium text-slate-500">Total Recebido</p>
          <h2 className="text-2xl font-bold text-green-600">
            {totalReceived.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h2>
        </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm font-medium text-slate-500">Pendente</p>
          <h2 className="text-2xl font-bold text-yellow-600">
             {totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h2>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex items-center gap-2 flex-1 max-w-2xl">
           <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                    type="text"
                    placeholder="Filtrar por nome ou documento..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
           </div>
           
           <select 
               className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
               value={selectedYear}
               onChange={(e) => setSelectedYear(e.target.value)}
           >
               {availableYears.map(year => (
                   <option key={year} value={year}>{year}</option>
               ))}
               <option value="all">Todos</option>
           </select>
        </div>
        
        <div className="flex gap-2">
            {showImportButton && (
                <Button variant="ghost" onClick={() => setIsImportModalOpen(true)} className="text-slate-600 bg-white border border-slate-200 animate-in zoom-in duration-300">
                    <Upload className="mr-2 h-4 w-4" /> Importar
                </Button>
            )}
            
             {isAdmin && (
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Empréstimo
                </Button>
             )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">TITULAR</th>
                <th className="px-4 py-3">DOC/CHEQUE</th>
                <th className="px-4 py-3">DATA EMP.</th>
                <th className="px-4 py-3">VALOR</th>
                <th className="px-4 py-3">VENCIMENTO</th>
                <th className="px-4 py-3 text-center">PRAZO</th>
                <th className="px-4 py-3">JUROS</th>
                <th className="px-4 py-3">TOTAL</th>
                <th className="px-4 py-3 text-center">STATUS</th>
                <th className="px-4 py-3 text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Carregando dados...</td>
                </tr>
              ) : currentLoans.length > 0 ? (
                currentLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-4 py-3 font-bold text-slate-700 uppercase">{loan.clientName}</td>
                   <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                       {loan.documentNumber || "-"}
                   </td>
                  <td className="px-4 py-3 text-slate-600">
                    {loan.loanDate?.seconds 
                        ? format(new Date(loan.loanDate.seconds * 1000), "dd/MM/yyyy") 
                        : "Data Inválida"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                     {loan.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-blue-600 font-medium">
                     {loan.dueDate?.seconds 
                        ? format(new Date(loan.dueDate.seconds * 1000), "dd/MM/yyyy") 
                        : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">
                        {loan.termDays}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-600 font-medium">
                     {loan.interestValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 bg-slate-50/50 group-hover:bg-slate-100/50">
                     {loan.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                      <div className={cn(
                          "w-2 h-2 rounded-full mx-auto",
                          loan.status === 'paid' ? "bg-green-500" : "bg-yellow-400"
                      )} title={loan.status === 'paid' ? "Pago" : "Pendente"} />
                  </td>
                  <td className="px-4 py-3 text-center">
                      {isAdmin && (
                          <button 
                            onClick={() => handleOpenModal(loan)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar Empréstimo"
                          >
                             <Edit2 size={18} />
                          </button>
                      )}
                  </td>
                </tr>
              ))
             ) : (
                <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        Nenhum empréstimo encontrado.
                    </td>
                </tr>
             )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                <div className="text-sm text-slate-500">
                    Mostrando <span className="font-medium text-slate-700">{startIndex + 1}</span> até{" "}
                    <span className="font-medium text-slate-700">
                        {Math.min(startIndex + itemsPerPage, filteredLoans.length)}
                    </span>{" "}
                    de <span className="font-medium text-slate-700">{filteredLoans.length}</span> resultados
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}
      </div>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={loadData}
     />

      {/* Loan Modal (Add/Edit) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLoan ? "Editar Empréstimo" : "Novo Empréstimo"}>
        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Top Row: Client & Doc */}
            <div className="flex flex-col sm:flex-row gap-4">
                 <div className="space-y-1.5 flex-1">
                    <label className="text-sm font-medium text-slate-700">Cliente *</label>
                    <select 
                        className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        required
                        disabled={!!editingLoan} // Disable client change during edit to prevent accidents? Or allow?
                    >
                        <option value="">SELECIONE...</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5 flex-1">
                    <Input 
                        label="Nº Documento / Cheque"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        placeholder="Ex: ch-123456"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Input 
                    label="Valor (R$) *"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0,00"
                />
                 <Input 
                    label="Taxa de Juros (%)"
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Input 
                    label="Data Empréstimo"
                    type="date"
                    value={loanDate}
                    onChange={handleLoanDateChange}
                    required
                />
                <Input 
                    label="Data Vencimento"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                />
            </div>

            {/* Calculations Preview */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Prazo Calculado:</span>
                    <span className="font-medium">{calculations.days} dias</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Juros ({interestRate}%):</span>
                    <span className="font-medium text-red-600">
                        {calculations.interest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-700">Total a Receber:</span>
                    <span className="font-bold text-lg text-blue-600">
                        {calculations.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            </div>

            {/* Payment Section (Edit Only) */}
            {editingLoan && (
                <div className="border-t border-slate-200 pt-4 mt-2">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center">
                        <CheckCircle size={16} className="mr-2 text-green-600" />
                        Baixar / Liquidar
                    </h4>
                    
                     <div className="flex gap-4 items-end bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="flex-1">
                             <label className="text-xs font-medium text-green-800 mb-1 block">
                                 Data do Pagamento
                             </label>
                             <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 h-4 w-4" />
                                <input 
                                    type="date" 
                                    className="w-full pl-9 pr-3 py-2 rounded-md border border-green-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    disabled={editingLoan.status === 'paid'}
                                />
                             </div>
                        </div>
                        {editingLoan.status === 'pending' ? (
                            <Button 
                                type="button" 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={handleMarkAsPaid}
                                disabled={isSubmitting}
                            >
                                Confirmar Pagamento
                            </Button>
                        ) : (
                            <Button 
                                type="button" 
                                variant="destructive"
                                className="bg-orange-600 hover:bg-orange-700 text-white flex gap-2 items-center"
                                onClick={handleReversePayment}
                                disabled={isSubmitting}
                            >
                                <RotateCcw size={16} /> Estornar
                            </Button>
                        )}
                     </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Salvar" : (editingLoan ? "Atualizar Dados" : "Criar Empréstimo")}
                </Button>
            </div>
        </form>
      </Modal>
    </div>
  );
}
