import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock3, AlertCircle, CheckCircle } from "lucide-react";

export default function AuthCallback() {
  const [status, setStatus] = useState("Processing authentication...");
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for error parameters in URL (e.g., from OAuth errors)
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        
        if (error) {
          console.error("Auth callback error:", error, errorDescription);
          setStatus(`Authentication failed: ${errorDescription || error}`);
          setStatusType("error");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }

        // First, try to get the session (for direct sign-in)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setStatus("Authentication failed. Please try again.");
          setStatusType("error");
          setTimeout(() => navigate("/login", { replace: true }), 2000);
          return;
        }

        if (sessionData.session) {
          // Successfully signed in - redirect to main app
          setStatus("Authentication successful! Redirecting to dashboard...");
          setStatusType("success");
          setTimeout(() => navigate("/", { replace: true }), 1000);
          return;
        }

        // No session - check if user exists (email confirmed but not signed in)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("User error:", userError);
          setStatus("Authentication incomplete. Please try signing in.");
          setStatusType("error");
          setTimeout(() => navigate("/login", { replace: true }), 2000);
          return;
        }

        if (user) {
          // User exists - check if email is confirmed
          if (user.email_confirmed_at) {
            // Email is confirmed but no session - redirect to login
            setStatus("Email confirmed! Please sign in to continue.");
            setStatusType("success");
          } else {
            // Email not confirmed yet
            setStatus("Please confirm your email address first.");
            setStatusType("error");
          }
        } else {
          // No user at all
          setStatus("Authentication incomplete. Please try again.");
          setStatusType("error");
        }

        setTimeout(() => navigate("/login", { replace: true }), 2500);
      } catch (err) {
        console.error("Unexpected error in auth callback:", err);
        setStatus("An unexpected error occurred. Redirecting to login...");
        setStatusType("error");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  const getStatusIcon = () => {
    switch (statusType) {
      case "success":
        return <CheckCircle size={24} className="text-[#10b981]" />;
      case "error":
        return <AlertCircle size={24} className="text-[#ef4444]" />;
      default:
        return <Clock3 size={24} className="text-white animate-spin" />;
    }
  };

  const getBackgroundColor = () => {
    switch (statusType) {
      case "success":
        return "bg-[#141b7b]";
      case "error":
        return "bg-[#7b1414]";
      default:
        return "bg-[#141b7b]";
    }
  };

  return (
    <div className="min-h-screen bg-[#101114] text-[#f2f3f5] flex items-center justify-center p-4">
      <div className="text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${getBackgroundColor()}`}>
          {getStatusIcon()}
        </div>
        <h2 className="text-[20px] font-bold tracking-[-.5px]">{status}</h2>
        <p className="mt-2 text-[13px] text-[#a0a3aa]">
          {statusType === "loading" 
            ? "Please wait while we process your authentication."
            : "Redirecting you to the sign in page..."}
        </p>
      </div>
    </div>
  );
}