import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileThumbnail, UniversalFilePreview } from '@/components/media/UniversalFilePreview';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseRealtimeReload } from '@/hooks/useSupabaseRealtimeReload';
import {
  Eye,
  ArrowLeft,
  Building2,
  Megaphone,
  BookOpen,
  Image,
  FileText,
  Package,
  Settings,
  Copy,
  Save,
  Pencil,
  ImageIcon,
  Video,
  FileIcon,
  Upload,
  Trash2,
  Grid,
  List,
  User,
  Lock,
  Mail,
  ExternalLink,
  EyeOff,
  X,
  Plus,
  Check,
  Download,
} from 'lucide-react';
import { RichTextEditor } from '@/components/dashboard/RichTextEditor';
import { SocialMediaInput, SocialMediaLink } from '@/components/dashboard/SocialMediaInput';
import { businessTypeCategories } from '@/data/businessTypes';
import { findCountryByName, findStateByName, getAllCountries, getCitiesOfState, getStatesOfCountry } from '@/lib/locations';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business_id: string | null;
  business_name: string | null;
  business_number: number | null;
}

interface BusinessFormData {
  business_name: string;
  business_type: string;
  country: string;
  state: string;
  city: string;
  zip_code: string;
  business_address: string;
  hours: { day: string; opensAt: string; closesAt: string; }[];
  website_url: string;
  gmb_link: string;

  // Contact
  email: string;
  email_secondary: string;

  phone: string;
  phoneCode: string;
  phoneNumber: string;

  phone_secondary: string;
  phoneSecondaryCode: string;
  phoneSecondaryNumber: string;

  first_name: string;
  last_name: string;
  social_links: SocialMediaLink[];
}

interface BusinessData {
  id: string;
  business_name: string | null;
  business_type: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
  gmb_link: string | null;
  social_links: any[];
  bkb_content: string | null;
  brand_expert_content: string | null;
  persona1_content: string | null;
  persona1_title: string | null;
  persona2_content: string | null;
  persona2_title: string | null;
  persona3_content: string | null;
  persona3_title: string | null;
}

interface KnowledgeBaseData {
  bkb: string;
  brandExpert: string;
  persona1: string;
  persona2: string;
  persona3: string;
  persona1Title: string;
  persona2Title: string;
  persona3Title: string;
}

interface GalleryItem {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number | null;
  created_at: string;
}

interface UserPackage {
  id: string;
  package_id: string;
  status: string;
  started_at: string;
  activated_at: string | null;
  expires_at: string | null;
  package: {
    name: string;
    price: number | null;
    type: string;
    features: any;
  } | null;
}

type DetailTab = 'business' | 'marketing' | 'knowledge' | 'gallery' | 'reports' | 'packages' | 'config';
type KBEditingState = {
  bkb: boolean;
  brandExpert: boolean;
  persona1: boolean;
  persona2: boolean;
  persona3: boolean;
};
type KnowledgeViewMode = 'bkb' | 'brandExpert' | 'persona1' | 'persona2' | 'persona3';

type ClientListProps = {
  initialClientId?: string;
  backTo?: string;
  hideClientList?: boolean;
  /**
   * Default: false.
   * When true, the initialClientId view will load even if the client is not payment_active.
   * (Used by Admin to review Pending/Approved/Suspended/Expired accounts.)
   */
  allowInactive?: boolean;
};

export default function ClientList({ initialClientId, backTo, hideClientList, allowInactive = false }: ClientListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('business');
  
  // Business data state
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [showEmailSecondary, setShowEmailSecondary] = useState(false);
  const [showPhoneSecondary, setShowPhoneSecondary] = useState(false);

  const [marketingSetup, setMarketingSetup] = useState({
    marketingGoalType: 'calls' as 'calls' | 'leads' | 'booking',
    marketingGoalText: '',
    primaryService: '',
    secondaryServices: [''],
    shortDescription: '',
    serviceArea: '',
  });
  const [isEditingMarketingSetup, setIsEditingMarketingSetup] = useState(false);
  const [savingMarketingSetup, setSavingMarketingSetup] = useState(false);

  const [formData, setFormData] = useState<BusinessFormData>({
    business_name: '',
    business_type: '',
    country: '',
    state: '',
    city: '',
    zip_code: '',
    business_address: '',
    hours: [],
    website_url: '',
    gmb_link: '',

    email: '',
    email_secondary: '',

    phone: '',
    phoneCode: '',
    phoneNumber: '',

    phone_secondary: '',
    phoneSecondaryCode: '',
    phoneSecondaryNumber: '',

    first_name: '',
    last_name: '',
    social_links: [],
  });
  
  const [newHour, setNewHour] = useState({ day: 'Monday', opensAt: '09:00', closesAt: '17:00' });
  
  // Knowledge Base state
  const [kbData, setKbData] = useState<KnowledgeBaseData>({
    bkb: '',
    brandExpert: '',
    persona1: '',
    persona2: '',
    persona3: '',
    persona1Title: 'My Persona 1',
    persona2Title: 'My Persona 2',
    persona3Title: 'My Persona 3',
  });
  const [kbEditingState, setKbEditingState] = useState<KBEditingState>({
    bkb: false,
    brandExpert: false,
    persona1: false,
    persona2: false,
    persona3: false,
  });
  const [kbViewMode, setKbViewMode] = useState<KnowledgeViewMode>('bkb');
  const [savingKB, setSavingKB] = useState(false);
  
  // Gallery state
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryViewMode, setGalleryViewMode] = useState<'grid' | 'list'>('grid');
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'image' | 'video' | 'file'>('all');
  const [galleryPreviewItem, setGalleryPreviewItem] = useState<GalleryItem | null>(null);
  const [galleryPreviewText, setGalleryPreviewText] = useState<string>('');
  const [galleryPreviewTextLoading, setGalleryPreviewTextLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Package state
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  
  // Config state
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const allCountries = getAllCountries();
  const selectedCountry = findCountryByName(formData.country);
  const states = selectedCountry ? getStatesOfCountry(selectedCountry.isoCode) : [];
  const selectedState = selectedCountry ? findStateByName(selectedCountry.isoCode, formData.state) : undefined;
  const cities = selectedCountry && selectedState ? getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode) : [];
  const phoneCodes = [...new Set(allCountries.map((c) => c.phoneCode).filter(Boolean))].sort();

  useEffect(() => {
    if (initialClientId) {
      void (async () => {
        try {
          setLoading(true);
          const [{ data: profile, error: profileErr }, { data: business, error: businessErr }] = await Promise.all([
            (supabase as any)
              .from('profiles')
              .select('id, name, email, phone, payment_active')
              .eq('id', initialClientId)
              .maybeSingle(),
            (supabase as any)
              .from('businesses')
              .select('id, user_id, business_name, business_number')
              .eq('user_id', initialClientId)
              .maybeSingle(),
          ]);

          if (profileErr) throw profileErr;
          if (businessErr) throw businessErr;
          if (!profile?.id) throw new Error('Client not found.');
           if (!allowInactive && !(profile as any)?.payment_active) throw new Error('Client is Pending (not Active).');

          const nextClient: Client = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            business_id: business?.id || null,
            business_name: business?.business_name || null,
            business_number: business?.business_number || null,
          };

          setClients([nextClient]);
          await handleViewDetails(nextClient);
        } catch (e: any) {
          toast({ variant: 'destructive', title: 'Failed to load client', description: e?.message || 'Something went wrong.' });
          if (backTo) navigate(backTo, { replace: true });
        } finally {
          setLoading(false);
        }
      })();

      return;
    }

    fetchClients();
  }, [initialClientId, backTo, navigate, toast]);

  const fetchClients = async () => {
    try {
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('id, name, email, phone, business_name, payment_active')
        .eq('payment_active', true);

      if (profilesError) throw profilesError;

      const { data: businesses, error: businessesError } = await (supabase as any)
        .from('businesses')
        .select('id, user_id, business_name, business_number');

      if (businessesError) throw businessesError;

      const { data: userRoles, error: rolesError } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'user');

      if (rolesError) throw rolesError;

      const userIds = userRoles?.map(r => r.user_id) || [];

      const clientList: Client[] = (profiles || [])
        .filter(p => userIds.includes(p.id))
        .map(profile => {
          const business = (businesses as any[])?.find((b: any) => b.user_id === profile.id);
          return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            business_id: business?.id || null,
            business_name: business?.business_name || null,
            business_number: business?.business_number || null,
          };
        });

      setClients(clientList);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFirstName = (name: string) => {
    return name?.split(' ')[0] || '-';
  };

  const getLastName = (name: string) => {
    const parts = name?.split(' ') || [];
    return parts.slice(1).join(' ') || '-';
  };

  const detectPlatform = (url: string): string => {
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.includes('facebook')) return 'facebook';
    if (lowercaseUrl.includes('instagram')) return 'instagram';
    if (lowercaseUrl.includes('twitter') || lowercaseUrl.includes('x.com')) return 'twitter';
    if (lowercaseUrl.includes('threads')) return 'threads';
    if (lowercaseUrl.includes('linkedin')) return 'linkedin';
    if (lowercaseUrl.includes('tiktok')) return 'tiktok';
    if (lowercaseUrl.includes('youtube')) return 'youtube';
    return 'facebook';
  };

  const handleViewDetails = async (client: Client) => {
    setSelectedClient(client);
    setShowDetails(true);
    setActiveTab('business');
    await fetchClientData(client);
  };

  const fetchClientData = async (client: Client) => {
    setLoadingBusiness(true);
    
    try {
      // Fetch business data
      const { data: business } = await (supabase as any)
        .from('businesses')
        .select('*')
        .eq('user_id', client.id)
        .maybeSingle();

      // Fetch profile data
      const { data: profileData } = await (supabase as any)
        .from('profiles')
        .select('phone, phone_secondary, name, email')
        .eq('id', client.id)
        .maybeSingle();

      if (business) {
        setBusinessData(business as unknown as BusinessData);
        
        // Parse social media links
        let socialLinks: SocialMediaLink[] = [];
        if (Array.isArray((business as any).social_links)) {
          socialLinks = ((business as any).social_links as any[]).map((link: any) => {
            if (typeof link === 'string') {
              const platform = detectPlatform(link);
              return { platform, url: link };
            }
            return link as SocialMediaLink;
          });
        }

        // Use location values directly
        const city = (business as any).city || '';
        const state = (business as any).state || '';
        const country = (business as any).country || '';
        const zipCode = (business as any).zip_code || '';

        // Parse phone into code and number
        const fullPhone = profileData?.phone || '';
        let phoneCode = '';
        let phoneNumber = fullPhone;

        const phoneMatch = fullPhone.match(/^(\+\d+)\s*(.*)$/);
        if (phoneMatch) {
          phoneCode = phoneMatch[1];
          phoneNumber = phoneMatch[2];
        }

        // Parse phone secondary into code and number
        const fullPhoneSecondary = (profileData as any)?.phone_secondary || '';
        let phoneSecondaryCode = '';
        let phoneSecondaryNumber = fullPhoneSecondary;

        const phoneSecondaryMatch = fullPhoneSecondary.match(/^(\+\d+)\s*(.*)$/);
        if (phoneSecondaryMatch) {
          phoneSecondaryCode = phoneSecondaryMatch[1];
          phoneSecondaryNumber = phoneSecondaryMatch[2];
        }

        const emailSecondary = (business as any).email_secondary || '';

        // Parse name into first and last
        const nameParts = (profileData?.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Parse hours
        const hoursData = Array.isArray((business as any).hours) 
          ? ((business as any).hours as any[]).map(h => ({
              day: h.day || '',
              opensAt: h.opens_at || h.opensAt || '',
              closesAt: h.closes_at || h.closesAt || '',
            }))
          : [];

        setFormData({
          business_name: (business as any).business_name || '',
          business_type: (business as any).business_type || '',
          country: country,
          state: state,
          city: city,
          zip_code: zipCode,
          business_address: (business as any).business_address || '',
          hours: hoursData,
          website_url: (business as any).website_url || '',
          gmb_link: (business as any).gmb_link || '',

          email: (profileData as any)?.email || client.email || '',
          email_secondary: emailSecondary,

          phone: fullPhone,
          phoneCode: phoneCode,
          phoneNumber: phoneNumber,

          phone_secondary: fullPhoneSecondary,
          phoneSecondaryCode: phoneSecondaryCode,
          phoneSecondaryNumber: phoneSecondaryNumber,

          first_name: firstName,
          last_name: lastName,
          social_links: socialLinks,
        });

        setShowEmailSecondary(Boolean(emailSecondary));
        setShowPhoneSecondary(Boolean(fullPhoneSecondary));

        // Load KB data
        setKbData({
          bkb: (business as any).bkb_content || '',
          brandExpert: (business as any).brand_expert_content || '',
          persona1: (business as any).persona1_content || '',
          persona2: (business as any).persona2_content || '',
          persona3: (business as any).persona3_content || '',
          persona1Title: (business as any).persona1_title || 'My Persona 1',
          persona2Title: (business as any).persona2_title || 'My Persona 2',
          persona3Title: (business as any).persona3_title || 'My Persona 3',
        });

        const secondaryServicesRaw = (business as any).secondary_services;
        const parsedSecondaryServices = Array.isArray(secondaryServicesRaw)
          ? (secondaryServicesRaw as any[]).map((v) => String(v ?? '')).filter((v) => v.trim() !== '')
          : [];

        setMarketingSetup({
          marketingGoalType: ((business as any).marketing_goal_type || 'calls') as 'calls' | 'leads' | 'booking',
          marketingGoalText: (business as any).marketing_goal_text || '',
          primaryService: (business as any).primary_service || '',
          secondaryServices: parsedSecondaryServices.length ? parsedSecondaryServices : [''],
          shortDescription: (business as any).service_short_description || '',
          serviceArea: (business as any).service_area || '',
        });
        setIsEditingMarketingSetup(false);
      } else {
        setBusinessData(null);
        setFormData({
          business_name: '',
          business_type: '',
          country: '',
          state: '',
          city: '',
          zip_code: '',
          business_address: '',
          hours: [],
          website_url: '',
          gmb_link: '',

          email: (profileData as any)?.email || client.email || '',
          email_secondary: '',

          phone: profileData?.phone || '',
          phoneCode: '',
          phoneNumber: profileData?.phone || '',

          phone_secondary: (profileData as any)?.phone_secondary || '',
          phoneSecondaryCode: '',
          phoneSecondaryNumber: (profileData as any)?.phone_secondary || '',

          first_name: getFirstName(profileData?.name || ''),
          last_name: getLastName(profileData?.name || ''),
          social_links: [],
        });

        setMarketingSetup({
          marketingGoalType: 'calls',
          marketingGoalText: '',
          primaryService: '',
          secondaryServices: [''],
          shortDescription: '',
          serviceArea: '',
        });
        setIsEditingMarketingSetup(false);

        setShowEmailSecondary(false);
        setShowPhoneSecondary(Boolean((profileData as any)?.phone_secondary));
      }

      // Fetch gallery
      const { data: galleryData } = await (supabase as any)
        .from('user_gallery')
        .select('*')
        .eq('user_id', client.id)
        .order('created_at', { ascending: false });

      setGallery((galleryData as any) || []);

      // Fetch packages
      const { data: packagesData } = await (supabase as any)
        .from('user_packages')
        .select(`id, package_id, status, started_at, activated_at, expires_at`)
        .eq('user_id', client.id);

      if (packagesData) {
        const packagesWithDetails = await Promise.all(
          (packagesData as any[]).map(async (up) => {
            const { data: pkg } = await (supabase as any)
              .from('packages')
              .select('name, price, type, features')
              .eq('id', up.package_id)
              .maybeSingle();
            return { ...up, package: pkg };
          })
        );
        setUserPackages(packagesWithDetails as any);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoadingBusiness(false);
    }
  };

  const syncFromDb = useCallback(() => {
    // Keep the list + currently opened client details always up to date.
    void fetchClients();
    if (showDetails && selectedClient) void fetchClientData(selectedClient);
  }, [showDetails, selectedClient]);

  useSupabaseRealtimeReload({
    channelName: "assist-clients-sync",
    targets: [
      { table: "profiles" },
      { table: "businesses" },
      { table: "user_roles" },
      { table: "user_gallery" },
      { table: "user_packages" },
      { table: "packages" },
    ],
    onChange: syncFromDb,
    debounceMs: 300,
  });

  const handleBack = () => {
    if (hideClientList && backTo) {
      navigate(backTo);
      return;
    }

    setShowDetails(false);
    setSelectedClient(null);
    setBusinessData(null);
    setGallery([]);
    setUserPackages([]);
    setIsEditingBusiness(false);
    setKbEditingState({ bkb: false, brandExpert: false, persona1: false, persona2: false, persona3: false });
  };

  const handleCountryChange = (country: string) => {
    const countryData = findCountryByName(country);
    setFormData(prev => ({
      ...prev,
      country,
      state: '',
      city: '',
      phoneCode: countryData?.phoneCode || prev.phoneCode,
    }));
  };

  const handleStateChange = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      state,
      city: '',
    }));
  };

  const handleSaveBusiness = async () => {
    if (!selectedClient) return;

    setSavingBusiness(true);
    try {
      // Filter out empty URLs before saving
      const validSocialLinks = formData.social_links.filter(link => link.url && link.url.trim() !== '');

      const fullPhone = `${formData.phoneCode} ${formData.phoneNumber}`.trim();
      const fullPhoneSecondary = formData.phoneSecondaryNumber
        ? `${formData.phoneSecondaryCode || formData.phoneCode} ${formData.phoneSecondaryNumber}`.trim()
        : '';

      const hoursForDb = formData.hours.map(h => ({
        day: h.day,
        opens_at: h.opensAt,
        closes_at: h.closesAt,
      }));

      const { error } = await supabase
        .from('businesses')
        .update({
          business_name: formData.business_name || null,
          business_type: formData.business_type || null,
          country: formData.country || null,
          state: formData.state || null,
          city: formData.city || null,
          zip_code: formData.zip_code || null,
          business_address: formData.business_address || null,
          hours: hoursForDb as any,
          website_url: formData.website_url, // Allow empty string
          gmb_link: formData.gmb_link || null,
          social_links: validSocialLinks as any,
          email_secondary: showEmailSecondary ? (formData.email_secondary || null) : null,
        })
        .eq('user_id', selectedClient.id);

      if (error) throw error;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: `${formData.first_name} ${formData.last_name}`.trim(),
          email: formData.email || null,
          phone: fullPhone || null,
          phone_secondary: showPhoneSecondary ? (fullPhoneSecondary || null) : null,
        })
        .eq('id', selectedClient.id);

      if (profileError) throw profileError;

      setIsEditingBusiness(false);
      toast({
        title: 'Saved!',
        description: 'Business information has been updated.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setSavingBusiness(false);
    }
  };

  // KB handlers
  const handleSaveKB = async (field: keyof KnowledgeBaseData) => {
    if (!selectedClient) return;
    
    setSavingKB(true);
    try {
      const fieldToColumn: Record<string, string> = {
        bkb: 'bkb_content',
        brandExpert: 'brand_expert_content',
        persona1: 'persona1_content',
        persona2: 'persona2_content',
        persona3: 'persona3_content',
      };
      
      const columnName = fieldToColumn[field];
      if (!columnName) return;
      
      const { error } = await supabase
        .from('businesses')
        .update({ [columnName]: kbData[field] })
        .eq('user_id', selectedClient.id);
      
      if (error) throw error;
      
      setKbEditingState(prev => ({ ...prev, [field]: false }));
      
      toast({
        title: 'Saved!',
        description: 'Knowledge base content has been saved.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save content.',
      });
    } finally {
      setSavingKB(false);
    }
  };

  const handlePersonaTitleChange = async (persona: 'persona1Title' | 'persona2Title' | 'persona3Title', newTitle: string) => {
    setKbData(prev => ({ ...prev, [persona]: newTitle }));
    await handleSaveKBTitle(persona, newTitle);
  };

  const handleSaveKBTitle = async (field: string, value: string) => {
    if (!selectedClient) return;
    
    try {
      const fieldToColumn: Record<string, string> = {
        persona1Title: 'persona1_title',
        persona2Title: 'persona2_title',
        persona3Title: 'persona3_title',
      };
      
      const columnName = fieldToColumn[field];
      if (!columnName) return;
      
      const { error } = await supabase
        .from('businesses')
        .update({ [columnName]: value })
        .eq('user_id', selectedClient.id);
      
      if (error) throw error;
      
      toast({
        title: 'Title Updated!',
        description: 'Persona title has been saved.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save title.',
      });
    }
  };

  const handleSaveMarketingSetup = async () => {
    if (!selectedClient) return;

    const primary = marketingSetup.primaryService.trim();
    if (!primary) {
      toast({
        variant: 'destructive',
        title: 'Primary Service is required',
        description: 'Please fill Primary Service before saving.',
      });
      return;
    }

    setSavingMarketingSetup(true);
    try {
      // Ensure the client has a businesses row (some accounts may not have one yet)
      const { data: existingBusiness, error: existingError } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', selectedClient.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existingBusiness?.id) {
        const { error: insertError } = await supabase.from('businesses').insert({ user_id: selectedClient.id });
        if (insertError) throw insertError;
      }

      const cleanedSecondary = marketingSetup.secondaryServices
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const { error } = await supabase
        .from('businesses')
        .update({
          marketing_goal_type: marketingSetup.marketingGoalType,
          marketing_goal_text: marketingSetup.marketingGoalText || null,
          primary_service: primary,
          secondary_services: cleanedSecondary as any,
          service_short_description: marketingSetup.shortDescription || null,
          service_area: marketingSetup.serviceArea || null,
        })
        .eq('user_id', selectedClient.id);

      if (error) throw error;

      // Refresh from DB so when you navigate away and come back it's already up-to-date
      await fetchClientData(selectedClient);

      toast({
        title: 'Saved!',
        description: 'Marketing setup has been updated.',
      });
      setIsEditingMarketingSetup(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save marketing setup.',
      });
    } finally {
      setSavingMarketingSetup(false);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'Content copied to clipboard.',
    });
  };

  // Gallery handlers
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedClient) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const type = file.type.startsWith('image/') 
        ? 'image' 
        : file.type.startsWith('video/') 
        ? 'video' 
        : 'file';

      const filePath = `${selectedClient.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: `Failed to upload ${file.name}`,
        });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('user-files')
        .getPublicUrl(filePath);

      const { data: dbData, error: dbError } = await (supabase as any)
        .from('user_gallery')
        .insert({
          user_id: selectedClient.id,
          name: file.name,
          type,
          url: urlData.publicUrl,
          size: file.size,
        })
        .select()
        .maybeSingle();

      if (dbData) {
        setGallery((prev) => [dbData as any, ...prev]);
      }
    }

    setUploading(false);
    toast({
      title: 'Uploaded!',
      description: `${files.length} file(s) uploaded successfully.`,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteGallery = async (item: GalleryItem) => {
    const filePath = item.url.split('/user-files/')[1];
    if (filePath) {
      await supabase.storage.from('user-files').remove([filePath]);
    }

    const { error } = await (supabase as any)
      .from('user_gallery')
      .delete()
      .eq('id', item.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete file.',
      });
      return;
    }

    setGallery(prev => prev.filter(m => m.id !== item.id));
    toast({
      title: 'Deleted',
      description: 'File has been removed.',
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'URL copied to clipboard.',
    });
  };

  const downloadGalleryItem = async (item: GalleryItem) => {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error('Failed to download file');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = item.name || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: e?.message || 'Unable to download file.',
      });
    }
  };

  // Text preview is now handled by UniversalFilePreview
  useEffect(() => {
    setGalleryPreviewText('');
    setGalleryPreviewTextLoading(false);
  }, [galleryPreviewItem]);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      default:
        return <FileIcon className="h-5 w-5" />;
    }
  };

  // Login as client
  const handleLoginAsClient = () => {
    if (!selectedClient) return;
    toast({
      title: 'Opening client session',
      description: 'This feature requires admin privileges.',
    });
    window.open('/dashboard/user', '_blank');
  };

  // Full-page client details view
  if (showDetails && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{selectedClient.business_name || selectedClient.name}</h1>
            <p className="text-muted-foreground break-words max-w-full">
              {selectedClient.email}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
          {/* Mobile/tablet: show all tabs without horizontal scrolling by wrapping into multiple rows */}
          <div className="w-full">
            <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1">
              <TabsTrigger value="business" className="flex items-center gap-2 text-xs sm:text-sm">
                <Building2 className="h-4 w-4" />
                Business Details
              </TabsTrigger>
              <TabsTrigger value="marketing" className="flex items-center gap-2 text-xs sm:text-sm">
                <Megaphone className="h-4 w-4" />
                Marketing Setup
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex items-center gap-2 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4" />
                Knowledge
              </TabsTrigger>
              <TabsTrigger value="gallery" className="flex items-center gap-2 text-xs sm:text-sm">
                <Image className="h-4 w-4" />
                Gallery
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="packages" className="flex items-center gap-2 text-xs sm:text-sm">
                <Package className="h-4 w-4" />
                Packages
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2 text-xs sm:text-sm">
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
            </TabsList>
          </div>

          {loadingBusiness ? (
            <div className="mt-6 animate-pulse space-y-4">
              <div className="h-48 bg-muted rounded-lg"></div>
            </div>
          ) : (
            <>
              {/* Business Details Tab - Synced with MyBusiness */}
              <TabsContent value="business" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Business Information</CardTitle>
                        <CardDescription>Client's business details (synced with User Dashboard)</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {isEditingBusiness ? (
                          <>
                            <Button variant="outline" onClick={() => setIsEditingBusiness(false)}>
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button onClick={handleSaveBusiness} disabled={savingBusiness}>
                              <Save className="h-4 w-4 mr-2" />
                              {savingBusiness ? 'Saving...' : 'Save'}
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => setIsEditingBusiness(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Business ID - Full Row */}
                    <div className="space-y-2">
                      <Label>Business ID</Label>
                      <p className="font-medium py-2 font-mono text-xs">
                        {selectedClient.business_number ? `B${String(selectedClient.business_number).padStart(5, '0')}` : '-'}
                      </p>
                    </div>

                    {/* First Name + Last Name */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2 min-w-0">
                        <Label>First Name</Label>
                        {isEditingBusiness ? (
                          <Input
                            value={formData.first_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                          />
                        ) : (
                          <p className="font-medium py-2">{formData.first_name || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        {isEditingBusiness ? (
                          <Input
                            value={formData.last_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          />
                        ) : (
                          <p className="font-medium py-2">{formData.last_name || '-'}</p>
                        )}
                      </div>
                    </div>

                    {/* Email + Phone Number */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Email</Label>
                          {isEditingBusiness && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setShowEmailSecondary((prev) => {
                                  const next = !prev;
                                  if (!next) {
                                    setFormData((p) => ({ ...p, email_secondary: '' }));
                                  }
                                  return next;
                                });
                              }}
                              aria-label={showEmailSecondary ? 'Remove secondary email' : 'Add secondary email'}
                            >
                              {showEmailSecondary ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>

                        {isEditingBusiness ? (
                          <>
                            <Input
                              value={formData.email}
                              placeholder="Email"
                              disabled
                            />
                            <p className="text-xs text-muted-foreground">
                              This is the primary login email and cannot be changed, but you can add a second email.
                            </p>

                            {showEmailSecondary && (
                              <div className="space-y-2 pt-2">
                                <Label>Email Secondary</Label>
                                <Input
                                  value={formData.email_secondary}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, email_secondary: e.target.value }))}
                                  placeholder="Email secondary"
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-1 py-2 min-w-0">
                            <p className="font-medium break-words">{formData.email || '-'}</p>
                            {formData.email_secondary ? (
                              <p className="text-sm text-muted-foreground break-words">{formData.email_secondary}</p>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between">
                          <Label>Phone Number</Label>
                          {isEditingBusiness && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setShowPhoneSecondary((prev) => {
                                  const next = !prev;
                                  if (!next) {
                                    setFormData((p) => ({
                                      ...p,
                                      phone_secondary: '',
                                      phoneSecondaryCode: '',
                                      phoneSecondaryNumber: '',
                                    }));
                                  }
                                  return next;
                                });
                              }}
                              aria-label={showPhoneSecondary ? 'Remove secondary phone number' : 'Add secondary phone number'}
                            >
                              {showPhoneSecondary ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>

                        {isEditingBusiness ? (
                          <>
                            <div className="flex gap-2">
                              <Select value={formData.phoneCode} onValueChange={(v) => setFormData(prev => ({ ...prev, phoneCode: v }))}>
                                <SelectTrigger className="w-28">
                                  <SelectValue placeholder="Code" />
                                </SelectTrigger>
                                <SelectContent>
                                  {phoneCodes.map((code) => (
                                    <SelectItem key={code} value={code}>{code}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                placeholder="Phone number"
                                className="flex-1"
                              />
                            </div>

                            {showPhoneSecondary && (
                              <div className="pt-2">
                                <div className="space-y-2">
                                  <Label>Phone Number Secondary</Label>
                                  <div className="flex gap-2">
                                    <Select
                                      value={formData.phoneSecondaryCode || formData.phoneCode}
                                      onValueChange={(v) => setFormData(prev => ({ ...prev, phoneSecondaryCode: v }))}
                                    >
                                      <SelectTrigger className="w-28">
                                        <SelectValue placeholder="Code" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {phoneCodes.map((code) => (
                                          <SelectItem key={code} value={code}>{code}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      value={formData.phoneSecondaryNumber}
                                      onChange={(e) => setFormData(prev => ({ ...prev, phoneSecondaryNumber: e.target.value }))}
                                      placeholder="Phone number secondary"
                                      className="flex-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-1 py-2">
                            <p className="font-medium">{formData.phone || '-'}</p>
                            {formData.phone_secondary ? (
                              <p className="text-sm text-muted-foreground">{formData.phone_secondary}</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Business Name + Business Type */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Business Name</Label>
                        {isEditingBusiness ? (
                          <Input
                            value={formData.business_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                          />
                        ) : (
                          <p className="font-medium py-2">{formData.business_name || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Business Type</Label>
                        {isEditingBusiness ? (
                          <Select value={formData.business_type} onValueChange={(value) => setFormData(prev => ({ ...prev, business_type: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {businessTypeCategories.map((category) => (
                                <SelectGroup key={category.category}>
                                  <SelectLabel>{category.category}</SelectLabel>
                                  {category.types.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium py-2">{formData.business_type || '-'}</p>
                        )}
                      </div>
                    </div>

                    {/* Country + State + City */}
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Country</Label>
                        {isEditingBusiness ? (
                          <Select value={formData.country} onValueChange={handleCountryChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border z-50">
                              {allCountries.map((c) => (
                                <SelectItem key={c.isoCode} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium py-2">{formData.country || '-'}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>State</Label>
                        {isEditingBusiness ? (
                          <Select value={formData.state} onValueChange={handleStateChange} disabled={!formData.country}>
                            <SelectTrigger>
                              <SelectValue placeholder={formData.country ? 'Select a state' : 'Select a country first'} />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border max-h-60 z-50">
                              {states.map((s) => (
                                <SelectItem key={s.isoCode} value={s.name}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium py-2">{formData.state || '-'}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>City</Label>
                        {isEditingBusiness ? (
                            <Select
                              value={formData.city}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, city: value }))}
                              disabled={!formData.country || !formData.state}
                            >
                            <SelectTrigger>
                              <SelectValue placeholder={formData.state ? 'Select city' : 'Select a state first'} />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border z-50">
                              {cities.map((city) => (
                                <SelectItem key={city.name} value={city.name}>
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium py-2">{formData.city || '-'}</p>
                        )}
                      </div>
                    </div>

                    {/* Business Address + Business Hours */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="business_address">Business Address</Label>
                        {isEditingBusiness ? (
                          <Input
                            id="business_address"
                            value={formData.business_address}
                            onChange={(e) => setFormData(prev => ({ ...prev, business_address: e.target.value }))}
                            placeholder="123 Business St"
                          />
                        ) : (
                          <p className="font-medium py-2">{formData.business_address || '-'}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Business Hours</Label>
                        {formData.hours.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {formData.hours.map((hour, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                                <span className="font-medium min-w-[70px]">{hour.day}</span>
                                <span className="text-muted-foreground">
                                  {hour.opensAt === '00:00' && hour.closesAt === '23:59'
                                    ? '24 Hours'
                                    : `${hour.opensAt} - ${hour.closesAt}`}
                                </span>
                                {isEditingBusiness && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, hours: formData.hours.filter((_, i) => i !== index) })}
                                    className="ml-auto h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!isEditingBusiness && formData.hours.length === 0 && (
                          <p className="font-medium py-2">-</p>
                        )}
                        {isEditingBusiness && (
                          <div className="flex gap-1">
                            <Select value={newHour.day} onValueChange={(v) => setNewHour({ ...newHour, day: v })}>
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Day" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border border-border z-50">
                                <SelectItem value="Monday">Mon</SelectItem>
                                <SelectItem value="Tuesday">Tue</SelectItem>
                                <SelectItem value="Wednesday">Wed</SelectItem>
                                <SelectItem value="Thursday">Thu</SelectItem>
                                <SelectItem value="Friday">Fri</SelectItem>
                                <SelectItem value="Saturday">Sat</SelectItem>
                                <SelectItem value="Sunday">Sun</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={newHour.opensAt}
                              onValueChange={(v) => {
                                if (v === '__24h__') {
                                  setNewHour({ ...newHour, opensAt: '00:00', closesAt: '23:59' });
                                  return;
                                }
                                setNewHour({ ...newHour, opensAt: v });
                              }}
                            >
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Opens" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border border-border max-h-60 z-50">
                                <SelectItem value="__24h__">24 Hours</SelectItem>
                                {Array.from({ length: 24 }, (_, i) => i).map(hour => 
                                  ['00', '30'].map(min => {
                                    const time = `${String(hour).padStart(2, '0')}:${min}`;
                                    return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                  })
                                )}
                              </SelectContent>
                            </Select>
                            <Select
                              value={newHour.closesAt}
                              onValueChange={(v) => {
                                if (v === '__24h__') {
                                  setNewHour({ ...newHour, opensAt: '00:00', closesAt: '23:59' });
                                  return;
                                }
                                setNewHour({ ...newHour, closesAt: v });
                              }}
                            >
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Closes" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border border-border max-h-60 z-50">
                                <SelectItem value="__24h__">24 Hours</SelectItem>
                                {Array.from({ length: 24 }, (_, i) => i).map(hour => 
                                  ['00', '30'].map(min => {
                                    const time = `${String(hour).padStart(2, '0')}:${min}`;
                                    return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                  })
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (newHour.day && newHour.opensAt && newHour.closesAt) {
                                  setFormData({ 
                                    ...formData, 
                                    hours: [...formData.hours, { day: newHour.day, opensAt: newHour.opensAt, closesAt: newHour.closesAt }] 
                                  });
                                  setNewHour({ day: 'Monday', opensAt: '09:00', closesAt: '17:00' });
                                }
                              }}
                              className="h-8 text-xs px-2"
                            >
                              Add
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>ZIP Code</Label>
                      {isEditingBusiness ? (
                        <Input
                          inputMode="numeric"
                          value={formData.zip_code}
                          onChange={(e) => setFormData((prev) => ({ ...prev, zip_code: e.target.value }))}
                          placeholder="e.g., 10210"
                        />
                      ) : (
                        <p className="font-medium py-2">{formData.zip_code || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Website URL</Label>
                      {isEditingBusiness ? (
                        <Input
                          value={formData.website_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                          placeholder="https://..."
                        />
                      ) : formData.website_url ? (
                        <a 
                          href={formData.website_url.startsWith('http') ? formData.website_url : `https://${formData.website_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium py-2 text-primary hover:underline flex items-center gap-2"
                        >
                          {formData.website_url}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <p className="font-medium py-2">-</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Google Business Profile</Label>
                      {isEditingBusiness ? (
                        <Input
                          value={formData.gmb_link}
                          onChange={(e) => setFormData(prev => ({ ...prev, gmb_link: e.target.value }))}
                          placeholder="https://..."
                        />
                      ) : formData.gmb_link ? (
                        <a 
                          href={formData.gmb_link.startsWith('http') ? formData.gmb_link : `https://${formData.gmb_link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium py-2 text-primary hover:underline flex items-center gap-2"
                        >
                          {formData.gmb_link}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <p className="font-medium py-2">-</p>
                      )}
                    </div>
                    
                    {isEditingBusiness ? (
                      <SocialMediaInput
                        links={formData.social_links}
                        onChange={(links) => setFormData(prev => ({ ...prev, social_links: links }))}
                      />
                    ) : (
                      <div className="space-y-2">
                        <Label>Social Media Links</Label>
                        <div className="flex flex-wrap gap-2">
                          {formData.social_links.length > 0 ? (
                            formData.social_links.map((link, i) => (
                              <a
                                key={i}
                                href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <Badge variant="secondary" className="capitalize">
                                  {link.platform}
                                </Badge>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ))
                          ) : (
                            <p className="text-muted-foreground">No social links</p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Marketing Setup Tab - Synced with User Marketing Setup */}
              <TabsContent value="marketing" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Marketing Setup</CardTitle>
                        <CardDescription>Services / offerings and marketing goal for this client.</CardDescription>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditingMarketingSetup(true)}
                          disabled={isEditingMarketingSetup}
                          className="sm:w-auto"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={handleSaveMarketingSetup}
                          disabled={!isEditingMarketingSetup || savingMarketingSetup}
                          className="sm:w-auto"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {savingMarketingSetup ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Services / Offerings</CardTitle>
                          <CardDescription>Describe what the client sells and where they serve.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="assist_primary_service">Primary Service*</Label>
                            <Input
                              id="assist_primary_service"
                              value={marketingSetup.primaryService}
                              onChange={(e) =>
                                setMarketingSetup((prev) => ({
                                  ...prev,
                                  primaryService: e.target.value,
                                }))
                              }
                              placeholder="e.g., Home Cleaning"
                              disabled={!isEditingMarketingSetup}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <Label>Secondary Service</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMarketingSetup((prev) => ({
                                    ...prev,
                                    secondaryServices: [...prev.secondaryServices, ''],
                                  }))
                                }
                                disabled={!isEditingMarketingSetup}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {marketingSetup.secondaryServices.map((value, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Input
                                    value={value}
                                    onChange={(e) =>
                                      setMarketingSetup((prev) => {
                                        const next = [...prev.secondaryServices];
                                        next[index] = e.target.value;
                                        return { ...prev, secondaryServices: next };
                                      })
                                    }
                                    placeholder={index === 0 ? 'e.g., Deep Cleaning' : 'e.g., Move-out Cleaning'}
                                    disabled={!isEditingMarketingSetup}
                                  />
                                  {marketingSetup.secondaryServices.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() =>
                                        setMarketingSetup((prev) => ({
                                          ...prev,
                                          secondaryServices: prev.secondaryServices.filter((_, i) => i !== index),
                                        }))
                                      }
                                      aria-label="Delete secondary service"
                                      disabled={!isEditingMarketingSetup}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="assist_service_short_desc">Short Description</Label>
                            <Textarea
                              id="assist_service_short_desc"
                              value={marketingSetup.shortDescription}
                              onChange={(e) =>
                                setMarketingSetup((prev) => ({
                                  ...prev,
                                  shortDescription: e.target.value,
                                }))
                              }
                              placeholder="Short, clear, benefit-focused description"
                              disabled={!isEditingMarketingSetup}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="assist_service_area">Service Area</Label>
                            <Input
                              id="assist_service_area"
                              value={marketingSetup.serviceArea}
                              onChange={(e) =>
                                setMarketingSetup((prev) => ({
                                  ...prev,
                                  serviceArea: e.target.value,
                                }))
                              }
                              placeholder="e.g., South Jakarta"
                              disabled={!isEditingMarketingSetup}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Marketing Goal</CardTitle>
                          <CardDescription>Pick the main outcome the client wants.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Marketing Goal</Label>
                            <div className={!isEditingMarketingSetup ? 'pointer-events-none opacity-70' : undefined}>
                              <RadioGroup
                                value={marketingSetup.marketingGoalType}
                                onValueChange={(value) =>
                                  setMarketingSetup((prev) => ({
                                    ...prev,
                                    marketingGoalType: value as 'calls' | 'leads' | 'booking',
                                  }))
                                }
                                className="grid gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id="assist_goal_calls" value="calls" />
                                  <Label htmlFor="assist_goal_calls">Calls</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id="assist_goal_leads" value="leads" />
                                  <Label htmlFor="assist_goal_leads">Leads</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id="assist_goal_booking" value="booking" />
                                  <Label htmlFor="assist_goal_booking">Bookings</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="assist_marketing_goal_text">Goal Details</Label>
                            <Input
                              id="assist_marketing_goal_text"
                              value={marketingSetup.marketingGoalText}
                              onChange={(e) =>
                                setMarketingSetup((prev) => ({
                                  ...prev,
                                  marketingGoalText: e.target.value,
                                }))
                              }
                              placeholder="e.g., 30 bookings per month"
                              disabled={!isEditingMarketingSetup}
                            />
                          </div>

                          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                            Tip: Keep goal details measurable (numbers + timeframe).
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Knowledge Base Tab - Synced with MyBusiness BKB */}
              <TabsContent value="knowledge" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Business Knowledge Base</CardTitle>
                        <CardDescription>Synced with User's Business Knowledge Base</CardDescription>
                      </div>
                      <Select value={kbViewMode} onValueChange={(v) => setKbViewMode(v as KnowledgeViewMode)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bkb">My BKB</SelectItem>
                          <SelectItem value="brandExpert">Brand Expert</SelectItem>
                          {/* Keep labels stable even if persona titles change */}
                          <SelectItem value="persona1">Persona 1</SelectItem>
                          <SelectItem value="persona2">Persona 2</SelectItem>
                          <SelectItem value="persona3">Persona 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {kbViewMode === 'bkb' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">My BKB (Business Knowledge Base)</h3>
                          {kbEditingState.bkb ? (
                            <Button size="sm" onClick={() => handleSaveKB('bkb')} disabled={savingKB}>
                              <Check className="h-4 w-4 mr-2" />{savingKB ? 'Saving...' : 'Done'}
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => setKbEditingState(prev => ({ ...prev, bkb: true }))}>
                              <Pencil className="h-4 w-4 mr-2" />Edit
                            </Button>
                          )}
                        </div>
                        {kbEditingState.bkb ? (
                          <RichTextEditor
                            value={kbData.bkb}
                            onChange={(v) => setKbData(prev => ({ ...prev, bkb: v }))}
                            onSave={() => handleSaveKB('bkb')}
                            title="My BKB"
                            description="Business Knowledge Base content"
                            icon={FileText}
                            saving={savingKB}
                            isEditing={true}
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg" dangerouslySetInnerHTML={{ __html: kbData.bkb || '<p class="text-muted-foreground">No content</p>' }} />
                        )}
                      </div>
                    )}
                    
                    {kbViewMode === 'brandExpert' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Brand Expert</h3>
                          {kbEditingState.brandExpert ? (
                            <Button size="sm" onClick={() => handleSaveKB('brandExpert')} disabled={savingKB}>
                              <Check className="h-4 w-4 mr-2" />{savingKB ? 'Saving...' : 'Done'}
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => setKbEditingState(prev => ({ ...prev, brandExpert: true }))}>
                              <Pencil className="h-4 w-4 mr-2" />Edit
                            </Button>
                          )}
                        </div>
                        {kbEditingState.brandExpert ? (
                          <RichTextEditor
                            value={kbData.brandExpert}
                            onChange={(v) => setKbData(prev => ({ ...prev, brandExpert: v }))}
                            onSave={() => handleSaveKB('brandExpert')}
                            title="Brand Expert"
                            description="Brand expert content"
                            icon={FileText}
                            saving={savingKB}
                            isEditing={true}
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg" dangerouslySetInnerHTML={{ __html: kbData.brandExpert || '<p class="text-muted-foreground">No content</p>' }} />
                        )}
                      </div>
                    )}
                    
                    {['persona1', 'persona2', 'persona3'].includes(kbViewMode) && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Input
                              value={kbData[`${kbViewMode}Title` as keyof KnowledgeBaseData]}
                              onChange={(e) => handlePersonaTitleChange(`${kbViewMode}Title` as any, e.target.value)}
                              className="w-full font-semibold"
                            />
                          </div>
                          <div className="flex gap-2">
                            {kbEditingState[kbViewMode as keyof KBEditingState] ? (
                              <Button size="sm" onClick={() => handleSaveKB(kbViewMode as keyof KnowledgeBaseData)} disabled={savingKB}>
                                <Check className="h-4 w-4 mr-2" />{savingKB ? 'Saving...' : 'Done'}
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => setKbEditingState(prev => ({ ...prev, [kbViewMode]: true }))}>
                                <Pencil className="h-4 w-4 mr-2" />Edit
                              </Button>
                            )}
                          </div>
                        </div>
                        {kbEditingState[kbViewMode as keyof KBEditingState] ? (
                          <RichTextEditor
                            value={kbData[kbViewMode as keyof KnowledgeBaseData]}
                            onChange={(v) => setKbData(prev => ({ ...prev, [kbViewMode]: v }))}
                            onSave={() => handleSaveKB(kbViewMode as keyof KnowledgeBaseData)}
                            title={kbData[`${kbViewMode}Title` as keyof KnowledgeBaseData] || 'Persona'}
                            description="Customer persona content"
                            icon={FileText}
                            saving={savingKB}
                            isEditing={true}
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg" dangerouslySetInnerHTML={{ __html: kbData[kbViewMode as keyof KnowledgeBaseData] || '<p class="text-muted-foreground">No content</p>' }} />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Gallery Tab */}
              <TabsContent value="gallery" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle>Client Gallery</CardTitle>
                        <CardDescription>Media files for this client</CardDescription>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Tabs value={galleryFilter} onValueChange={(v) => setGalleryFilter(v as any)}>
                          <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="image">Images</TabsTrigger>
                            <TabsTrigger value="video">Videos</TabsTrigger>
                            <TabsTrigger value="file">Files</TabsTrigger>
                          </TabsList>
                        </Tabs>

                        <div className="flex gap-2">
                          <div className="flex border rounded-lg">
                            <Button
                              variant={galleryViewMode === 'grid' ? 'secondary' : 'ghost'}
                              size="icon"
                              onClick={() => setGalleryViewMode('grid')}
                            >
                              <Grid className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={galleryViewMode === 'list' ? 'secondary' : 'ghost'}
                              size="icon"
                              onClick={() => setGalleryViewMode('list')}
                            >
                              <List className="h-4 w-4" />
                            </Button>
                          </div>

                          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            <Upload className="h-4 w-4 mr-2" />
                            {uploading ? 'Uploading...' : 'Upload'}
                          </Button>

                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                            onChange={handleUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {(() => {
                      const filteredGallery = gallery.filter((item) => {
                        if (galleryFilter === 'all') return true;
                        return item.type === galleryFilter;
                      });

                      if (filteredGallery.length === 0) {
                        return (
                          <div className="text-center py-12">
                            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="font-medium">No files</h3>
                            <p className="text-muted-foreground text-sm">
                              {gallery.length === 0 ? 'Upload files for this client' : 'No files match this filter'}
                            </p>
                          </div>
                        );
                      }

                      if (galleryViewMode === 'grid') {
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {filteredGallery.map((item) => (
                              <div key={item.id} className="group relative aspect-square bg-muted rounded-lg overflow-hidden">
                                {item.type === 'image' ? (
                                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : item.type === 'video' ? (
                                  <FileThumbnail name={item.name} mimeType="video/*" />
                                ) : (
                                  <FileThumbnail name={item.name} />
                                )}

                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button variant="secondary" size="icon" onClick={() => setGalleryPreviewItem(item)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="secondary" size="icon" onClick={() => handleCopyUrl(item.url)}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button variant="secondary" size="icon" onClick={() => void downloadGalleryItem(item)} aria-label="Download">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => handleDeleteGallery(item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredGallery.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{item.type}</Badge>
                                </TableCell>
                                <TableCell>{formatSize(item.size)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => setGalleryPreviewItem(item)}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleCopyUrl(item.url)}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => void downloadGalleryItem(item)} aria-label="Download">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGallery(item)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Dialog open={!!galleryPreviewItem} onOpenChange={(open) => !open && setGalleryPreviewItem(null)}>
                  <DialogContent className="max-w-6xl h-[85vh] flex flex-col relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setGalleryPreviewItem(null)}
                      className="absolute right-4 top-4 z-10"
                      aria-label="Close preview"
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    <DialogHeader>
                      <DialogTitle className="flex items-center justify-between gap-3 pr-12">
                        <span className="truncate">{galleryPreviewItem?.name}</span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => galleryPreviewItem && handleCopyUrl(galleryPreviewItem.url)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => galleryPreviewItem && downloadGalleryItem(galleryPreviewItem)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 min-h-0">
                      {(() => {
                        const item = galleryPreviewItem;
                        if (!item) return null;

                        const mimeType = item.type === 'image' ? 'image/*' : item.type === 'video' ? 'video/*' : '';

                        return (
                          <div className="h-full w-full rounded-lg bg-muted overflow-hidden">
                            <UniversalFilePreview
                              source={{ kind: 'remote', name: item.name, mimeType, url: item.url }}
                              className="h-full w-full"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reports</CardTitle>
                    <CardDescription>Client reports and analytics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center py-8">Reports coming soon</p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Packages Tab */}
              <TabsContent value="packages" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Packages</CardTitle>
                    <CardDescription>Subscribed packages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userPackages.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No packages</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Package</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Activation Date</TableHead>
                            <TableHead>Expires Date</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userPackages.map((up) => (
                            <TableRow key={up.id}>
                              <TableCell className="font-medium">{up.package?.name || '-'}</TableCell>
                              <TableCell><Badge variant="outline">{up.package?.type || '-'}</Badge></TableCell>
                              <TableCell>${up.package?.price || 0}</TableCell>
                              <TableCell>
                                {up.activated_at 
                                  ? new Date(up.activated_at).toLocaleDateString('id-ID', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {up.expires_at 
                                  ? new Date(up.expires_at).toLocaleDateString('id-ID', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })
                                  : '-'}
                              </TableCell>
                              <TableCell><Badge>{up.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Config Tab */}
              <TabsContent value="config" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Configuration</CardTitle>
                    <CardDescription>Account settings and access</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
                        <Input value={selectedClient.email} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Lock className="h-4 w-4" />Password</Label>
                        <div className="flex gap-2">
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            value="••••••••" 
                            disabled 
                            className="bg-muted"
                          />
                          <Button variant="outline" size="icon" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <Button onClick={handleLoginAsClient}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Login as Client
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    );
  }

  // Client List View
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Client List</h1>
        <p className="text-muted-foreground">Manage your business clients</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>View and manage all business clients</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium">No clients yet</h3>
              <p className="text-muted-foreground text-sm">Clients will appear here when they register</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.business_name || 'Not set'}</TableCell>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.phone || 'Not set'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(client)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}