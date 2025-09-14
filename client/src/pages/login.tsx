import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
//import { googleSheetsClient } from "@/services/googleSheets";
import { useLocation } from "wouter";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!auth) {
      setError('Firebase auth yapılandırılmamış. Lütfen yöneticinize başvurun.');
      setLoading(false);
      return;
    }

      try {
        // Sign in with Firebase
        await signInWithEmailAndPassword(auth, email, password);

        // NOTE: client-side Google Sheets login has been deprecated. If your
        // deployment requires Google Sheets API access, perform authentication
        // server-side or via an admin flow. Continue to dashboard.
        setLocation('/');
      } catch (err: any) {
      console.error("Firebase kimlik doğrulama hatası:", err);
      setError(err.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-[420px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Görkem İnşaat</CardTitle>
          <CardDescription>Belge Yönetim Sistemi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              E-posta ve şifrenizle giriş yapın
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                required
              />
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Giriş yapılıyor..." : "E-posta ile Giriş"}
              </Button>
            </form>
            
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}