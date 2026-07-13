"use client";

import { useState, memo, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { invalidateAuthCache, invalidateProfileCache } from "@/lib/cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChefHat, Loader2 } from "lucide-react";

function AuthPageInner() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toggleMode = useCallback(() => {
    setIsLogin((p) => !p);
    setError(null);
    setMessage(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : error.message);
      } else {
        invalidateAuthCache();
        invalidateProfileCache();
        window.location.href = "/chat";
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("¡Cuenta creada! Revisa tu email para confirmar tu cuenta.");
      }
    }
    setLoading(false);
  }, [email, password, isLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <ChefHat className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Bienvenido a ChefBot" : "Crear cuenta"}
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            {isLogin
              ? "Inicia sesión para acceder a tu asistente culinario"
              : "Regístrate gratis y empieza a cocinar con IA"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="chef@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="password">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md border border-destructive/20">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-500/10 text-green-400 text-sm px-3 py-2 rounded-md border border-green-500/20">
                {message}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin
                ? "¿No tienes cuenta? Regístrate"
                : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(AuthPageInner);
