import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import Login from "./pages/Login";
import ClientsPage from "./pages/Clients";
import Dashboard from "./pages/Dashboard";
import { Users, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "./lib/utils";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <Layout />;
}

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: "Empréstimos", href: "/", icon: LayoutDashboard },
    { label: "Clientes", href: "/clients", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 z-10 relative">
        <div className="flex items-center gap-2">
           <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold">
             C
           </div>
           <h1 className="font-bold text-lg text-slate-800 hidden sm:block">Controle de Empréstimos</h1>
        </div>
        
        <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 hidden sm:block">{user?.displayName}</span>
            <button 
              onClick={() => logout()}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {isAdmin && (
          <aside className="w-64 bg-white border-r border-slate-200 hidden md:block pt-6">
             <nav className="space-y-1 px-3">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link 
                      key={item.href}
                      to={item.href} 
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors",
                        isActive 
                          ? "bg-blue-50 text-blue-700" 
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <item.icon size={20} className={isActive ? "text-blue-600" : "text-slate-400"} />
                      {item.label}
                    </Link>
                  )
                })}
             </nav>
          </aside>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 relative">
           <div className="max-w-7xl mx-auto">
              <Outlet />
           </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
