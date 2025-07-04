'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { type Case } from '@/types';
import { HistoryCard } from '@/components/HistoryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const casesRef = collection(db, 'cases');
    const q = query(
      casesRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const casesData: Case[] = [];
      querySnapshot.forEach((doc) => {
        casesData.push({ id: doc.id, ...doc.data() } as Case);
      });
      setCases(casesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  if (authLoading || (!user)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Case History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : cases.length > 0 ? (
            <div className="space-y-4">
              {cases.map((caseItem) => (
                <HistoryCard key={caseItem.id} caseItem={caseItem} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              You have no saved cases. Your work will appear here automatically.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
