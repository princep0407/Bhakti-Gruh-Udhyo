import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PurchaseForm } from './components/PurchaseForm';
import { ConsumptionForm } from './components/ConsumptionForm';
import { StockTable } from './components/StockTable';
import { AdminDashboard } from './components/AdminDashboard';
import { IngredientsManager } from './components/IngredientsManager';
import { Reports } from './components/Reports';
import { Logs } from './components/Logs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { LogIn, LogOut, Package, ShoppingCart, Utensils, LayoutDashboard, History, List, FileBarChart, FileText, Menu, X } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

export default function App() {
  const { t, lang, setLang } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('purchase');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Login/Signup form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let role = 'user';
        if (userDoc.exists()) {
          role = userDoc.data().role;
        } else {
          role = user.email === 'ghanshyampatel4721@gmail.com' ? 'admin' : 'user';
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0],
            role: role
          });
        }
        setIsAdmin(role === 'admin');
        setUser(user);
        if (role === 'admin') {
          setActiveTab('dashboard');
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('email_password_required'));
      return;
    }
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success(t('account_created'));
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success(t('login_successful'));
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error(t('wrong_email_password'));
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error(t('email_in_use'));
      } else if (error.code === 'auth/weak-password') {
        toast.error(t('weak_password'));
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error(t('login_disabled'));
      } else {
        toast.error(t('error_occurred') + ': ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success(t('logout_successful'));
    } catch (error) {
      console.error(error);
      toast.error(t('logout_error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-secondary/50 via-background to-background p-4 font-sans">
        <Card className="w-full max-w-md border-none glass neo-shadow overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-accent h-2 w-full" />
          <CardHeader className="text-center space-y-4 pt-8">
            <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit shadow-inner">
              <Package className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-4xl font-bold tracking-tight text-gradient">{t('app_title')}</CardTitle>
              <CardDescription className="text-lg text-slate-500">
                {isSignUp ? t('create_new_account') : t('stock_management_login')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-600 font-medium">{t('email')}</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder={t('your_email')} 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-slate-50/50 border-slate-200 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-600 font-medium">{t('password')}</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder={t('your_password')} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-slate-50/50 border-slate-200 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-semibold gap-2 shadow-lg hover:shadow-primary/20 transition-all" disabled={authLoading}>
                {authLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    {isSignUp ? t('sign_up') : t('login')}
                  </>
                )}
              </Button>
              
              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {isSignUp ? t('already_have_account') : t('need_account')}
                </button>
              </div>

              <p className="text-center text-xs text-slate-400 bg-slate-50 rounded-lg py-2">
                {t('admin_login_note')}
              </p>
            </form>
          </CardContent>
        </Card>
        <Toaster position="top-center" />
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard'), adminOnly: true },
    { id: 'purchase', icon: ShoppingCart, label: t('purchase') },
    { id: 'consumption', icon: Utensils, label: t('consumption') },
    { id: 'history', icon: History, label: t('history') },
    { id: 'logs', icon: FileText, label: t('logs') },
    { id: 'reports', icon: FileBarChart, label: t('reports'), adminOnly: true },
    { id: 'ingredients', icon: List, label: t('items'), adminOnly: true },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Toaster position="top-center" />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r shadow-2xl transform transition-transform duration-500 ease-in-out lg:relative lg:translate-x-0 flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b flex items-center justify-between bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <Package className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-black text-primary tracking-tight">
              {t('app_title')}
            </h1>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-primary transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setIsMobileMenuOpen(false); }} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-1 flex-col items-stretch justify-start p-4 space-y-1 bg-transparent h-auto overflow-y-auto">
            {navItems.map(item => {
              if (item.adminOnly && !isAdmin) return null;
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="flex items-center justify-start gap-3 px-4 py-3.5 w-full rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-primary/20 transition-all duration-300 text-slate-500 hover:bg-slate-50 hover:text-primary group border-none"
                >
                  <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                  <span className="font-bold tracking-tight">{item.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <div className="p-4 border-t space-y-4 bg-slate-50">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('language')}</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="gu">ગુજરાતી</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2 truncate px-1">{user.email}</p>
            <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="font-bold text-primary">{t('app_title')}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-50/50">
          <Tabs value={activeTab} className="h-full">
            {isAdmin && (
              <TabsContent value="dashboard" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
                <AdminDashboard />
              </TabsContent>
            )}
            <TabsContent value="purchase" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
              <div className="max-w-4xl mx-auto">
                <PurchaseForm />
              </div>
            </TabsContent>
            <TabsContent value="consumption" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
              <div className="max-w-4xl mx-auto">
                <ConsumptionForm />
              </div>
            </TabsContent>
            <TabsContent value="history" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 gap-10 max-w-6xl mx-auto">
                <StockTable type="purchase" />
                <StockTable type="consumption" />
              </div>
            </TabsContent>
            <TabsContent value="logs" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
              <div className="max-w-6xl mx-auto">
                <Logs />
              </div>
            </TabsContent>
            {isAdmin && (
              <>
                <TabsContent value="reports" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
                  <Reports />
                </TabsContent>
                <TabsContent value="ingredients" className="m-0 h-full animate-in fade-in zoom-in-95 duration-500">
                  <div className="max-w-5xl mx-auto">
                    <IngredientsManager />
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
}
