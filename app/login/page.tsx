'use client';
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in error:", error);
      setError(error.message || "Failed to sign in");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-md border border-gray-300 hover:bg-gray-50 cursor-pointer"
      >
        Sign in with Google
      </button>
    </div>
  );
}