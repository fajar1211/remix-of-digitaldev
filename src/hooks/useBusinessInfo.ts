import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BusinessInfo = {
  id: string;
  business_number: number | null;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  business_type: string | null;
  email: string | null;
  website_url: string | null;
  gmb_link: string | null;
  bkb_content: string | null;
  brand_expert_content: string | null;
  persona1_content: string | null;
  persona2_content: string | null;
  persona3_content: string | null;
};

export function useBusinessInfo(userId?: string) {
  const [data, setData] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: business, error } = await supabase
          .from("businesses")
          .select(
            [
              "id",
              "business_number",
              "first_name",
              "last_name",
              "business_name",
              "business_type",
              "email",
              "website_url",
              "gmb_link",
              "bkb_content",
              "brand_expert_content",
              "persona1_content",
              "persona2_content",
              "persona3_content",
            ].join(",")
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;
        setData((business as unknown as BusinessInfo) ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load business info");
        setData(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return { data, loading, error };
}
