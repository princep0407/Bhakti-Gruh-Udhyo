import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, XCircle, Shield, ShieldAlert, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '@/lib/utils';

export function UserManager() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const userData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !currentStatus
      });
      toast.success(t('status_updated') || 'Status updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      toast.success(t('role_updated') || 'Role updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm(t('confirm_delete_user') || 'Are you sure you want to delete this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success(t('user_deleted') || 'User deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tight">{t('user_management')}</h2>
          <p className="text-muted-foreground">{t('user_management_desc')}</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-2xl">
          <Users className="h-6 w-6 text-primary" />
        </div>
      </div>

      <Card className="border-none neo-shadow overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted text-muted-foreground text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">{t('email')}</th>
                  <th className="px-6 py-4">{t('role')}</th>
                  <th className="px-6 py-4">{t('status')}</th>
                  <th className="px-6 py-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{user.displayName || user.email?.split('@')[0]}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.role === 'admin' ? "default" : "secondary"} className="font-bold uppercase tracking-widest text-[10px]">
                        {user.role === 'admin' ? (
                          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {t('admin')}</span>
                        ) : (
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t('user_role')}</span>
                        )}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.isActive ? "success" : "destructive"} className={cn(
                        "font-bold uppercase tracking-widest text-[10px]",
                        user.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"
                      )}>
                        {user.isActive ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {t('active')}</span>
                        ) : (
                          <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> {t('inactive')}</span>
                        )}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={cn(
                            "h-8 gap-1 font-bold text-[10px] uppercase tracking-wider",
                            user.isActive ? "text-amber-600 border-amber-200 hover:bg-amber-50" : "text-green-600 border-green-200 hover:bg-green-50"
                          )}
                          onClick={() => toggleStatus(user.id, user.isActive)}
                        >
                          {user.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          {user.isActive ? t('deactivate') : t('activate')}
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-1 font-bold text-[10px] uppercase tracking-wider"
                          onClick={() => toggleRole(user.id, user.role)}
                        >
                          {user.role === 'admin' ? <ShieldAlert className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                          {user.role === 'admin' ? t('remove_admin') : t('make_admin')}
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteUser(user.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
