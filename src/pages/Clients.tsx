import { useEffect, useState } from "react";
import { Plus, Search, Users, Edit2 } from "lucide-react";
import { addClient, getClients, updateClient, type Client } from "../services/client-service";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit State
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState(""); // New Email State
  const [newCpf, setNewCpf] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error("Failed to fetch clients", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenModal(client?: Client) {
      if (client) {
          setEditingClient(client);
          setNewName(client.name);
          setNewPhone(client.phone || "");
          setNewEmail(client.email || ""); // Set Email
          setNewCpf(client.cpf || "");
          setNewAddress(client.address || "");
      } else {
          setEditingClient(null);
          resetForm();
      }
      setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName) return;

    setIsSubmitting(true);
    try {
      if (editingClient) {
          await updateClient(editingClient.id!, {
              name: newName,
              phone: newPhone,
              email: newEmail,
              cpf: newCpf,
              address: newAddress
          });
      } else {
          await addClient({
            name: newName,
            phone: newPhone,
            email: newEmail,
            cpf: newCpf,
            address: newAddress,
          });
      }
      setIsModalOpen(false);
      resetForm();
      fetchClients();
    } catch (error) {
      console.error("Failed to save client", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewCpf("");
    setNewAddress("");
    setEditingClient(null);
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) // Search by Email
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            Clientes
          </h1>
          <p className="text-slate-500">Gerencie seus contatos e clientes</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Buscar cliente por nome ou email..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Carregando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
             <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <Users className="text-slate-400 h-6 w-6" />
             </div>
             <p className="text-slate-500">Nenhum cliente encontrado.</p>
             <Button variant="ghost" onClick={() => handleOpenModal()}>Cadastrar o primeiro</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">E-mail</th>
                  <th className="px-6 py-3">Telefone</th>
                  <th className="px-6 py-3">CPF</th>
                  <th className="px-6 py-3">Endereço</th>
                  <th className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-700">{client.name}</td>
                    <td className="px-6 py-3 text-slate-500">{client.email || "-"}</td>
                    <td className="px-6 py-3 text-slate-500">{client.phone || "-"}</td>
                    <td className="px-6 py-3 text-slate-500">{client.cpf || "-"}</td>
                    <td className="px-6 py-3 text-slate-500 max-w-xs truncate">{client.address || "-"}</td>
                    <td className="px-6 py-3 text-center">
                        <button 
                            onClick={() => handleOpenModal(client)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Editar Dados"
                        >
                            <Edit2 size={16} />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient ? "Editar Cliente" : "Novo Cliente"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome Completo *"
            placeholder="Ex: João da Silva"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="E-mail de Acesso"
            type="email"
            placeholder="cliente@exemplo.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            helperText="Use o e-mail do Google do cliente para permitir acesso aos dados."
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefone"
              placeholder="(00) 00000-0000"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              value={newCpf}
              onChange={(e) => setNewCpf(e.target.value)}
            />
          </div>
          <Input
            label="Endereço"
            placeholder="Rua, Número, Bairro"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
          />
          
          <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
             <Button type="submit" disabled={isSubmitting}>
               {isSubmitting ? "Salvando..." : (editingClient ? "Atualizar Dados" : "Salvar Cliente")}
             </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
