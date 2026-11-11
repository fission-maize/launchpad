import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock3 } from "lucide-react";

export default function AuthCallback() {
  const [status, setStatus] = useState("Processing authentication...");
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth callback error:", error);
          setStatus("Authentication failed. Please try again.");
          setTimeout(() => navigate("/login", { replace: true }), 2000);
          return;
        }

        if (data.session) {
          setStatus("Authentication successful! Redirecting...");
          setTimeout(() => navigate("/", { replace: true }), 1000);
        } else {
          setStatus("Authentication incomplete. Please try again.");
          setTimeout(() => navigate("/login", { replace: true }), 2000);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("An unexpected error occurred. Please try again.");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#101114] text-[#f2f3f5] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#141b7b]">
          <Clock3 size={24} className="text-white" />
        </div>
        <h2 className="text-[20px] font-bold tracking-[-.5px]">{status}</h2>
        <p className="mt-2 text-[13px] text-[#a0a3aa]">
          Please wait while we redirect you to your Rain dashboard.
        </p>
      </div>
    </div>
  );
}