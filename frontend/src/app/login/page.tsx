"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/logo";
import { Sparkles, Mail, Lock, Loader2, ArrowRight, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        firstName,
        lastName,
        isRegister: isRegister.toString(),
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/chat");
        router.refresh();
      }
    } catch (err: any) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 p-4 overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1e1e24_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.15, 0.35, 0.15]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
            opacity: [0.1, 0.25, 0.1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[100px]" 
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 20 }}
        className="w-full max-w-md z-10"
      >
        <Card className="border-zinc-800/80 bg-zinc-900/30 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-indigo-500/25 transition-all duration-500 rounded-3xl">
          {/* Top border glow line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
          
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.5 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
              >
                <Logo className="h-10 w-10" />
              </motion.div>
            </div>
            
            <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
              {isRegister ? "Create an account" : "Welcome back"}
            </CardTitle>
            
            <CardDescription className="text-zinc-400 flex items-center justify-center gap-1.5 text-sm mt-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              {isRegister
                ? "Enter details below to register with ReForge"
                : "Enter details below to access your secure space"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pb-6">
            <AnimatePresence mode="wait">
              <motion.form 
                key={isRegister ? "register" : "login"}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit} 
                className="space-y-4"
              >
                {error && (
                  <Alert variant="destructive" className="border-red-900/40 bg-red-950/20 text-red-400 rounded-xl">
                    <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                  </Alert>
                )}
                
                {isRegister && (
                  <div className="flex gap-4">
                    <div className="space-y-2 w-1/2">
                      <Label htmlFor="firstName" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="Alice"
                          required={isRegister}
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="pl-11 border-zinc-800 bg-zinc-950/60 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 hover:border-zinc-700/80 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 w-1/2">
                      <Label htmlFor="lastName" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1">Last Name</Label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Smith"
                          required={isRegister}
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="pl-11 border-zinc-800 bg-zinc-950/60 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 hover:border-zinc-700/80 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@domain.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 border-zinc-800 bg-zinc-950/60 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 hover:border-zinc-700/80 transition-colors"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 border-zinc-800 bg-zinc-950/60 rounded-xl text-zinc-100 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 hover:border-zinc-700/80 transition-colors"
                    />
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/30 hover:-translate-y-0.5 mt-2 active:translate-y-0"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      {isRegister ? "Sign Up" : "Sign In"}
                      <ArrowRight className="h-4 w-4 transition-transform" />
                    </span>
                  )}
                </Button>
              </motion.form>
            </AnimatePresence>
          </CardContent>
          
          <CardFooter className="flex justify-center border-t border-zinc-800/60 pt-5 pb-6 bg-zinc-950/30">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs font-medium text-zinc-400 hover:text-indigo-400 transition-colors py-1 px-3 rounded-lg hover:bg-indigo-500/5"
            >
              {isRegister
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
