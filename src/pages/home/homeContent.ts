import { Briefcase, Globe, MessageCircle, Sparkles, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { Lang } from "@/i18n/dict";

export type HomeStep = { step: string; title: string; description: string };
export type HomeCardItem = { icon: LucideIcon; title: string; description: string };

export function getHomeContent(lang: Lang): {
  steps: HomeStep[];
  whoItsFor: HomeCardItem[];
  services: HomeCardItem[];
} {
  if (lang === "en") {
    return {
      steps: [
        { step: "01", title: "Choose Your Package", description: "Pick the marketing assistance that fits your business needs and budget." },
        { step: "02", title: "Get Your Dedicated Assist", description: "You'll be matched with a marketing assist who understands your goals." },
        { step: "03", title: "Watch Your Business Grow", description: "Sit back while your assist handles the marketing, keeping you updated every step." },
      ],
      whoItsFor: [
        { icon: Briefcase, title: "New Business Owners", description: "Just starting out and need help getting online presence established." },
        { icon: TrendingUp, title: "Growing Businesses", description: "Ready to scale but don't have time for marketing tasks." },
        { icon: Users, title: "Solo Entrepreneurs", description: "Wearing too many hats and need reliable marketing support." },
      ],
      services: [
        { icon: Globe, title: "Google Business Profile", description: "Get found locally with optimized GMB setup and management." },
        { icon: MessageCircle, title: "Social Media Posting", description: "Consistent, engaging posts that build your brand presence." },
        { icon: Sparkles, title: "Website Development", description: "Beautiful, fast websites that convert visitors into customers." },
      ],
    };
  }

  return {
    steps: [
      { step: "01", title: "Pilih Paketmu", description: "Pilih bantuan marketing yang sesuai kebutuhan dan budget bisnismu." },
      { step: "02", title: "Dapatkan Assist Khusus", description: "Kamu akan dipasangkan dengan marketing assist yang memahami tujuanmu." },
      { step: "03", title: "Lihat Bisnismu Bertumbuh", description: "Fokus ke bisnismu, biar assist mengurus marketing sambil memberi update rutin." },
    ],
    whoItsFor: [
      { icon: Briefcase, title: "Pemilik Bisnis Baru", description: "Baru mulai dan butuh bantuan membangun kehadiran online." },
      { icon: TrendingUp, title: "Bisnis Berkembang", description: "Siap scale tapi tidak punya waktu untuk tugas marketing." },
      { icon: Users, title: "Solo Entrepreneur", description: "Mengurus banyak hal sekaligus dan butuh dukungan marketing yang andal." },
    ],
    services: [
      { icon: Globe, title: "Google Business Profile", description: "Mudah ditemukan secara lokal dengan optimasi & pengelolaan GBP." },
      { icon: MessageCircle, title: "Posting Media Sosial", description: "Posting konsisten dan engaging untuk membangun brand." },
      { icon: Sparkles, title: "Pembuatan Website", description: "Website yang cantik, cepat, dan mengonversi pengunjung jadi pelanggan." },
    ],
  };
}
