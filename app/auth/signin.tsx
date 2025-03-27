'use client';

import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";

export default function SignIn() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (error: any) {
      if (error.code === "auth/cancelled-popup-request") {
        console.warn("Popup sign in cancelled by user.");
      } else {
        console.error("Google sign in error:", error);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>
      <button
        onClick={handleSignIn}
        className="px-6 py-3 rounded-md bg-white border border-gray-300 text-gray-700 shadow hover:bg-gray-50"
      >
        Sign In with Google
      </button>
    </div>
  );
}