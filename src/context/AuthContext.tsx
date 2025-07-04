'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, isFirebaseConfigMissing } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigMissing) {
      setLoading(false);
      return;
    }
    // `auth` is guaranteed to be non-null here because `isFirebaseConfigMissing` is false.
    const unsubscribe = onAuthStateChanged(auth!, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isFirebaseConfigMissing) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
        <div className="max-w-2xl rounded-lg border border-destructive bg-card p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-destructive">
            Firebase Configuration Missing
          </h1>
          <p className="mt-4 text-card-foreground">
            Your Firebase environment variables are not set. Please add your
            project credentials to a <code>.env</code> file in the root of your
            project.
          </p>
          <div className="mt-6 w-full rounded-md bg-muted p-4 text-left text-sm">
            <pre className="whitespace-pre-wrap font-code">
{`NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...`}
            </pre>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            You can find these keys in your Firebase project settings. After
            adding them to the file, please restart the development server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
