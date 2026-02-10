import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Building2, FileText, User, Users, ArrowLeft, Pencil, X, Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextEditor } from '@/components/dashboard/RichTextEditor';
import { SocialMediaInput, SocialMediaLink } from '@/components/dashboard/SocialMediaInput';
import { findCountryByName, findStateByName, getAllCountries, getCitiesOfState, getStatesOfCountry } from '@/lib/locations';
import { businessTypeCategories } from '@/data/businessTypes';
import { useSupabaseRealtimeReload } from '@/hooks/useSupabaseRealtimeReload';
import { useBusinessTypes } from '@/hooks/useBusinessTypes';

interface BusinessData {
  name: string;
  business_type: string;
  country: string;
  state: string;
  city: string;
  zip_code: string;
  business_address: string;
  website_url: string;
  gmb_link: string;
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
  social_media_links: SocialMediaLink[];
  businessId: string;
  hours: { day: string; opensAt: string; closesAt: string; }[];
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

type KBEditingState = {
  bkb: boolean;
  brandExpert: boolean;
  persona1: boolean;
  persona2: boolean;
  persona3: boolean;
};

const DRAFT_STORAGE_KEY = 'business_details_draft';
const KB_DRAFT_STORAGE_KEY = 'kb_draft';

export default function MyBusiness() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { categories: businessTypesFromDb } = useBusinessTypes({ fallback: businessTypeCategories });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKB, setSavingKB] = useState(false);
  const [savingMarketingSetup, setSavingMarketingSetup] = useState(false);
  const [currentView, setCurrentView] = useState<'details' | 'knowledge-base'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [showEmailSecondary, setShowEmailSecondary] = useState(false);
  const [showPhoneSecondary, setShowPhoneSecondary] = useState(false);

  const [marketingSetupOpen, setMarketingSetupOpen] = useState(false);
  const [isEditingMarketingSetup, setIsEditingMarketingSetup] = useState(false);
  const [marketingSetup, setMarketingSetup] = useState({
    marketingGoalType: 'calls' as 'calls' | 'leads' | 'booking',
    marketingGoalText: '',
    primaryService: '',
    secondaryServices: [''],
    shortDescription: '',
    serviceArea: '',
  });

  // Track the businesses row (some accounts may not have a row yet)
  const [businessRowId, setBusinessRowId] = useState<string | null>(null);

  // Original data from database (to restore on cancel)
  const [originalFormData, setOriginalFormData] = useState<BusinessData | null>(null);
  const [originalKbData, setOriginalKbData] = useState<KnowledgeBaseData | null>(null);

  const [formData, setFormData] = useState<BusinessData>({
    name: '',
    business_type: '',
    country: '',
    state: '',
    city: '',
    zip_code: '',
    business_address: '',
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
    social_media_links: [],
    businessId: '',
    hours: [],
  });

  const [newHour, setNewHour] = useState({ day: '', opensAt: '', closesAt: '' });
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
    bkb: true,
    brandExpert: true,
    persona1: true,
    persona2: true,
    persona3: true,
  });

  const allCountries = getAllCountries();
  const selectedCountry = findCountryByName(formData.country);
  const states = selectedCountry ? getStatesOfCountry(selectedCountry.isoCode) : [];
  const selectedState = selectedCountry ? findStateByName(selectedCountry.isoCode, formData.state) : undefined;
  const cities = selectedCountry && selectedState ? getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode) : [];
  const phoneCodes = [...new Set(allCountries.map((c) => c.phoneCode).filter(Boolean))].sort();

  // Keep secondary field visibility in sync with loaded data (but don't override while editing)
  useEffect(() => {
    if (!isEditing) {
      setShowEmailSecondary(!!formData.email_secondary);
      setShowPhoneSecondary(!!formData.phoneSecondaryNumber);
    }
  }, [isEditing, formData.email_secondary, formData.phoneSecondaryNumber]);

  // Load KB draft from localStorage on mount
  useEffect(() => {
    if (!user) return;

    const savedKbDraft = localStorage.getItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`);
    if (savedKbDraft) {
      try {
        const parsed = JSON.parse(savedKbDraft);
        setKbData((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse KB draft');
      }
    }
  }, [user]);

  // Save draft to localStorage whenever form data changes (only when editing)
  useEffect(() => {
    if (user && isEditing && originalFormData) {
      localStorage.setItem(`${DRAFT_STORAGE_KEY}_${user.id}`, JSON.stringify(formData));
    }
  }, [formData, user, isEditing, originalFormData]);

  // Save KB draft to localStorage whenever KB data changes
  useEffect(() => {
    if (user && originalKbData) {
      const hasChanges = JSON.stringify(kbData) !== JSON.stringify(originalKbData);
      if (hasChanges) {
        localStorage.setItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`, JSON.stringify(kbData));
      }
    }
  }, [kbData, user, originalKbData]);

  const fetchBusiness = useCallback(async () => {
    if (!user) return;

      // Check for synced data from onboarding
      const syncFirstName = sessionStorage.getItem('sync_firstName');
      const syncLastName = sessionStorage.getItem('sync_lastName');
      
      // Clear after reading
      if (syncFirstName) sessionStorage.removeItem('sync_firstName');
      if (syncLastName) sessionStorage.removeItem('sync_lastName');

      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch profile for phone number
      const { data: profileData } = await supabase
        .from('profiles')
        .select('phone, phone_secondary, name')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setBusinessRowId((data as any).id);
        // Parse social media links
        let socialLinks: SocialMediaLink[] = [];
        if (Array.isArray((data as any).social_links)) {
          socialLinks = ((data as any).social_links as any[]).map((link: any) => {
            if (typeof link === 'string') {
              const platform = detectPlatform(link);
              return { platform, url: link };
            }
            return link as SocialMediaLink;
          });
        }

        // Use country and city directly
        const city = (data as any).city || '';
        const country = (data as any).country || '';
        const state = (data as any).state || '';

        // Parse phone into code and number
        const fullPhone = profileData?.phone || '';
        let phoneCode = '';
        let phoneNumber = fullPhone;

        // Try to extract phone code
        const phoneMatch = fullPhone.match(/^(\+\d+)\s*(.*)$/);
        if (phoneMatch) {
          phoneCode = phoneMatch[1];
          phoneNumber = phoneMatch[2];
        }

        // Parse secondary phone into code and number
        const fullPhoneSecondary = (profileData as any)?.phone_secondary || '';
        let phoneSecondaryCode = '';
        let phoneSecondaryNumber = fullPhoneSecondary;

        const phoneSecondaryMatch = fullPhoneSecondary.match(/^(\+\d+)\s*(.*)$/);
        if (phoneSecondaryMatch) {
          phoneSecondaryCode = phoneSecondaryMatch[1];
          phoneSecondaryNumber = phoneSecondaryMatch[2];
        }

        // Parse name into first and last
        const nameParts = (profileData?.name || '').split(' ');
        const firstName = syncFirstName || nameParts[0] || '';
        const lastName = syncLastName || nameParts.slice(1).join(' ') || '';

        const businessNumber = (data as any).business_number as number | null;
        const businessId = businessNumber ? `B${businessNumber.toString().padStart(5, '0')}` : '';

        const rawHours = Array.isArray((data as any).hours) ? (data as any).hours : [];
        const normalizedHours = rawHours
          .map((h: any) => {
            if (!h || typeof h !== 'object') return null;
            const day = String(h.day ?? h.Day ?? '').trim();
            const opensAt = String(h.opensAt ?? h.opens_at ?? h.opens ?? h.open ?? '').trim();
            const closesAt = String(h.closesAt ?? h.closes_at ?? h.closes ?? h.close ?? '').trim();
            if (!day || !opensAt || !closesAt) return null;
            return { day, opensAt, closesAt };
          })
          .filter(Boolean) as { day: string; opensAt: string; closesAt: string }[];

        const dbFormData: BusinessData = {
          name: (data as any).business_name || '',
          business_type: (data as any).business_type || '',
          country: country,
          state: state,
          city: city,
          zip_code: (data as any).zip_code || '',
          business_address: (data as any).business_address || '',
          website_url: (data as any).website_url || '',
          gmb_link: (data as any).gmb_link || '',
          email: (data as any).email || user.email || '',
          email_secondary: (data as any).email_secondary || '',
          phone: fullPhone,
          phoneCode: phoneCode,
          phoneNumber: phoneNumber,
          phone_secondary: fullPhoneSecondary,
          phoneSecondaryCode,
          phoneSecondaryNumber,
          first_name: firstName,
          last_name: lastName,
          social_media_links: socialLinks,
          businessId,
          hours: normalizedHours,
        };
        
        setOriginalFormData(dbFormData);

        // IMPORTANT: never overwrite unsaved edits.
        // If user is editing, keep the current formData (draft is stored in localStorage).
        if (!isEditing) {
          // Source of truth in view-mode: always reflect what is saved in DB.
          // Drafts are only applied when the user explicitly enters Edit mode.
          setFormData(dbFormData);
        }

        // Load KB data from database
        const dbKbData: KnowledgeBaseData = {
          bkb: (data as any).bkb_content || '',
          brandExpert: (data as any).brand_expert_content || '',
          persona1: (data as any).persona1_content || '',
          persona2: (data as any).persona2_content || '',
          persona3: (data as any).persona3_content || '',
          persona1Title: (data as any).persona1_title || 'My Persona 1',
          persona2Title: (data as any).persona2_title || 'My Persona 2',
          persona3Title: (data as any).persona3_title || 'My Persona 3',
        };
        
        setOriginalKbData(dbKbData);
        
        // Check if there's a KB draft
        const kbDraft = localStorage.getItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`);
        if (!kbDraft) {
          setKbData(dbKbData);
        }
        
        // Set editing state based on saved data
        const hasData = Object.values(dbKbData).some((val: any) => val && val.length > 0);
        if (hasData) {
          setKbEditingState({
            bkb: !dbKbData.bkb,
            brandExpert: !dbKbData.brandExpert,
            persona1: !dbKbData.persona1,
            persona2: !dbKbData.persona2,
            persona3: !dbKbData.persona3,
          });
        }
      } else {
        setBusinessRowId(null);
        const defaultData: BusinessData = {
          ...formData,
          email: user.email || '',
          email_secondary: '',
          phone_secondary: '',
          phoneSecondaryCode: '',
          phoneSecondaryNumber: '',
          first_name: syncFirstName || '',
          last_name: syncLastName || '',
          businessId: formData.businessId || '',
        };
        setFormData(defaultData);
        setOriginalFormData(defaultData);
        
        const defaultKbData: KnowledgeBaseData = {
          bkb: '',
          brandExpert: '',
          persona1: '',
          persona2: '',
          persona3: '',
          persona1Title: 'My Persona 1',
          persona2Title: 'My Persona 2',
          persona3Title: 'My Persona 3',
        };
        setOriginalKbData(defaultKbData);
      }
      
    setLoading(false);
  }, [user, formData.businessId, isEditing]);

  useEffect(() => {
    void fetchBusiness();
  }, [fetchBusiness]);

  // Keep page in sync with DB changes (realtime). Avoid overwriting user input while editing.
  useSupabaseRealtimeReload({
    channelName: user ? `dashboard-user-business:${user.id}` : 'dashboard-user-business:anonymous',
    targets: user
      ? [
          { table: 'businesses', filter: `user_id=eq.${user.id}` },
          { table: 'profiles', filter: `id=eq.${user.id}` },
        ]
      : [],
    debounceMs: 300,
    onChange: async () => {
      if (!user) return;
      if (document.visibilityState !== 'visible') return;
      if (isEditing || saving || savingKB || savingMarketingSetup || isEditingMarketingSetup) return;
      await fetchBusiness();
    },
  });

  const handleStartEdit = () => {
    if (!user) {
      setIsEditing(true);
      return;
    }

    // If a draft exists, apply it only when user chooses to edit.
    const savedDraft = localStorage.getItem(`${DRAFT_STORAGE_KEY}_${user.id}`);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as Partial<BusinessData>;
        // Merge with the latest DB snapshot to avoid missing keys / stale schema.
        setFormData((prev) => ({ ...prev, ...parsed } as BusinessData));
      } catch {
        // Ignore invalid drafts
      }
    }

    setIsEditing(true);
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

  const ensureBusinessRow = async (): Promise<string | null> => {
    if (!user) return null;
    if (businessRowId) return businessRowId;

    // 1) Re-check from DB (in case it was created elsewhere)
    const { data: existing, error: existingError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.id) {
      setBusinessRowId(existing.id);
      return existing.id;
    }

    // 2) Create minimal row so subsequent updates (KB save) always persist
    const { data: inserted, error: insertError } = await supabase
      .from('businesses')
      .insert({ user_id: user.id })
      .select('id')
      .single();

    if (insertError) throw insertError;

    setBusinessRowId(inserted.id);
    return inserted.id;
  };

  const loadKbFromDb = async (ensuredId: string) => {
    const { data, error } = await supabase
      .from('businesses')
      .select(
        'bkb_content, brand_expert_content, persona1_content, persona2_content, persona3_content, persona1_title, persona2_title, persona3_title'
      )
      .eq('id', ensuredId)
      .maybeSingle();

    if (error) throw error;

    const dbKbData: KnowledgeBaseData = {
      bkb: (data as any)?.bkb_content || '',
      brandExpert: (data as any)?.brand_expert_content || '',
      persona1: (data as any)?.persona1_content || '',
      persona2: (data as any)?.persona2_content || '',
      persona3: (data as any)?.persona3_content || '',
      persona1Title: (data as any)?.persona1_title || 'My Persona 1',
      persona2Title: (data as any)?.persona2_title || 'My Persona 2',
      persona3Title: (data as any)?.persona3_title || 'My Persona 3',
    };

    setKbData(dbKbData);
    setOriginalKbData(dbKbData);

    const hasData = Object.values(dbKbData).some((val: any) => val && val.length > 0);
    if (hasData) {
      setKbEditingState({
        bkb: !dbKbData.bkb,
        brandExpert: !dbKbData.brandExpert,
        persona1: !dbKbData.persona1,
        persona2: !dbKbData.persona2,
        persona3: !dbKbData.persona3,
      });
    }
  };

  const handleOpenKnowledgeBase = async () => {
    if (!user) return;
    try {
      const ensuredId = await ensureBusinessRow();
      if (!ensuredId) throw new Error('No user session');

      // Force the KB view to reflect what is saved in DB (ignore any stale drafts).
      localStorage.removeItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`);
      await loadKbFromDb(ensuredId);

      setCurrentView('knowledge-base');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to open Knowledge Base.',
      });
    }
  };

  const loadMarketingSetupFromDb = async (ensuredId: string) => {
    const { data, error } = await supabase
      .from('businesses')
      .select(
        'marketing_goal_type, marketing_goal_text, primary_service, secondary_services, service_short_description, service_area'
      )
      .eq('id', ensuredId)
      .maybeSingle();

    if (error) throw error;

    const secondaryRaw = (data as any)?.secondary_services;
    const secondaryParsed = Array.isArray(secondaryRaw)
      ? (secondaryRaw as any[]).map((v) => String(v ?? '')).filter((v) => v.trim() !== '')
      : [];

    setMarketingSetup({
      marketingGoalType: (((data as any)?.marketing_goal_type as any) || 'calls') as 'calls' | 'leads' | 'booking',
      marketingGoalText: (data as any)?.marketing_goal_text || '',
      primaryService: (data as any)?.primary_service || '',
      secondaryServices: secondaryParsed.length ? secondaryParsed : [''],
      shortDescription: (data as any)?.service_short_description || '',
      serviceArea: (data as any)?.service_area || '',
    });
  };

  const handleOpenMarketingSetup = async () => {
    if (!user) return;

    try {
      const ensuredId = await ensureBusinessRow();
      if (!ensuredId) throw new Error('No user session');

      await loadMarketingSetupFromDb(ensuredId);
      setIsEditingMarketingSetup(false);
      setMarketingSetupOpen(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to open Marketing Setup.',
      });
    }
  };

  const handleSaveMarketingSetup = async () => {
    if (!user) return;

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
      const ensuredId = await ensureBusinessRow();
      if (!ensuredId) throw new Error('No user session');

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
        .eq('id', ensuredId);

      if (error) throw error;

      // Ensure next time you open this page, you see DB state
      await loadMarketingSetupFromDb(ensuredId);
      setMarketingSetupOpen(false);

      toast({
        title: 'Saved!',
        description: 'Marketing setup has been updated.',
      });
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

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const ensuredId = await ensureBusinessRow();
      if (!ensuredId) throw new Error('No user session');

      const location = formData.city && formData.country 
        ? `${formData.city}, ${formData.country}` 
        : formData.country || formData.city || null;

      const fullPhone = `${formData.phoneCode} ${formData.phoneNumber}`.trim();
      const fullPhoneSecondary = formData.phoneSecondaryNumber
        ? `${formData.phoneSecondaryCode || formData.phoneCode} ${formData.phoneSecondaryNumber}`.trim()
        : '';

      // Filter out empty URLs before saving
      const validSocialLinks = formData.social_media_links.filter(link => link.url && link.url.trim() !== '');

      const { error } = await supabase
        .from('businesses')
        .update({
          business_name: formData.name || null,
          business_type: formData.business_type || null,
          country: formData.country || null,
          state: formData.state || null,
          city: formData.city || null,
          zip_code: formData.zip_code || null,
          business_address: formData.business_address || null,
          website_url: formData.website_url, // Allow empty string
          gmb_link: formData.gmb_link || null,
          email: formData.email || null,
          email_secondary: formData.email_secondary || null,
          social_links: validSocialLinks as any,
          hours: formData.hours as any,
        })
        .eq('id', ensuredId);

      if (error) throw error;

      // Update profile with name and phone
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: `${formData.first_name} ${formData.last_name}`.trim(),
          phone: fullPhone || null,
          phone_secondary: fullPhoneSecondary || null,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Clear draft after successful save
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${user.id}`);
      
      // Update original data to current data
      setOriginalFormData(formData);
      setIsEditing(false);
      
      toast({
        title: 'Saved!',
        description: 'Your business information has been updated.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Restore original data and clear draft
    if (originalFormData) {
      setFormData(originalFormData);
    }
    if (user) {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${user.id}`);
    }
    setIsEditing(false);
  };

  const handleSaveKB = async (field: keyof KnowledgeBaseData) => {
    if (!user) return;

    setSavingKB(true);
    try {
      const ensuredId = await ensureBusinessRow();
      if (!ensuredId) throw new Error('No user session');

      // Map field names to database columns
      const fieldToColumn: Record<string, string> = {
        bkb: 'bkb_content',
        brandExpert: 'brand_expert_content',
        persona1: 'persona1_content',
        persona2: 'persona2_content',
        persona3: 'persona3_content',
        persona1Title: 'persona1_title',
        persona2Title: 'persona2_title',
        persona3Title: 'persona3_title',
      };

      const columnName = fieldToColumn[field];
      if (!columnName) return;

      const updateData: Record<string, any> = {
        [columnName]: kbData[field],
      };

      const { error } = await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', ensuredId);

      if (error) throw error;

      // After saving: reflect DB as source of truth in UI
      localStorage.removeItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`);
      await loadKbFromDb(ensuredId);

      // After saving, disable editing for content fields
      if (['bkb', 'brandExpert', 'persona1', 'persona2', 'persona3'].includes(field)) {
        setKbEditingState(prev => ({ ...prev, [field]: false }));
      }

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
    // Auto-save title change
    await handleSaveKBTitle(persona, newTitle);
  };

  const handleSaveKBTitle = async (field: string, value: string) => {
    if (!user) return;

    try {
      const ensuredId = await ensureBusinessRow();
      if (!ensuredId) throw new Error('No user session');

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
        .eq('id', ensuredId);

      if (error) throw error;

      // Keep UI aligned with DB after title update
      localStorage.removeItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`);
      await loadKbFromDb(ensuredId);

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

  const handleEditKB = (field: keyof KnowledgeBaseData) => {
    setKbEditingState(prev => ({ ...prev, [field]: true }));
  };

  const handleBackToDetails = () => {
    // Restore KB data from original (discard draft changes)
    if (originalKbData) {
      setKbData(originalKbData);
    }
    if (user) {
      localStorage.removeItem(`${KB_DRAFT_STORAGE_KEY}_${user.id}`);
    }
    setCurrentView('details');
  };

  const handleCountryChange = (country: string) => {
    const countryData = findCountryByName(country);
    setFormData((prev) => ({
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
        <h1 className="text-3xl font-bold text-foreground">My Business</h1>
        <p className="text-muted-foreground">Manage your business information</p>
      </div>

      {currentView === 'details' ? (
        <>
          <Card>
            <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Business Details</CardTitle>
                  <CardDescription>Update your business information anytime</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isEditing ? (
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={handleStartEdit}
                    className="flex items-center gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMarketingSetup}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Marketing Setup
                </Button>

                <Button 
                  variant="outline" 
                  onClick={handleOpenKnowledgeBase}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Knowledge Files
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="business_id">Business ID</Label>
              <Input
                id="business_id"
                value={formData.businessId || 'Will be generated after onboarding'}
                disabled
              />
            </div>

            {/* Contact Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email">Email</Label>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (showEmailSecondary) {
                          setShowEmailSecondary(false);
                          setFormData(prev => ({ ...prev, email_secondary: '' }));
                        } else {
                          setShowEmailSecondary(true);
                        }
                      }}
                      aria-label={showEmailSecondary ? 'Remove secondary email' : 'Add secondary email'}
                    >
                      {showEmailSecondary ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  )}
                </div>

                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  disabled
                />
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    This is the primary login email and cannot be changed, but you can add a second email.
                  </p>
                )}

                {showEmailSecondary && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="email_secondary">Email Secondary</Label>
                    <Input
                      id="email_secondary"
                      type="email"
                      value={formData.email_secondary}
                      onChange={(e) => setFormData({ ...formData, email_secondary: e.target.value })}
                      placeholder="john.secondary@example.com"
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="phone">Phone Number</Label>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (showPhoneSecondary) {
                          setShowPhoneSecondary(false);
                          setFormData(prev => ({
                            ...prev,
                            phone_secondary: '',
                            phoneSecondaryCode: '',
                            phoneSecondaryNumber: '',
                          }));
                        } else {
                          setShowPhoneSecondary(true);
                          setFormData(prev => ({
                            ...prev,
                            phoneSecondaryCode: prev.phoneSecondaryCode || prev.phoneCode,
                          }));
                        }
                      }}
                      aria-label={showPhoneSecondary ? 'Remove secondary phone number' : 'Add secondary phone number'}
                    >
                      {showPhoneSecondary ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Select 
                    value={formData.phoneCode} 
                    onValueChange={(value) => setFormData({ ...formData, phoneCode: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="+1" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border max-h-60 z-50">
                      {phoneCodes.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="234 567 8900"
                    disabled={!isEditing}
                    className="flex-1"
                  />
                </div>

                {showPhoneSecondary && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="phone_secondary">Phone Number Secondary</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={formData.phoneSecondaryCode} 
                        onValueChange={(value) => setFormData({ ...formData, phoneSecondaryCode: value })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder={formData.phoneCode || '+1'} />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border max-h-60 z-50">
                          {phoneCodes.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="phone_secondary"
                        type="tel"
                        value={formData.phoneSecondaryNumber}
                        onChange={(e) => setFormData({ ...formData, phoneSecondaryNumber: e.target.value })}
                        placeholder="234 567 8900"
                        disabled={!isEditing}
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Business Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Business Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your Business Name"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Business Type</Label>
                <Select 
                  value={formData.business_type} 
                  onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                  disabled={!isEditing}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border max-h-80 z-50">
                    {businessTypesFromDb.map((category) => (
                      <SelectGroup key={category.category}>
                        <SelectLabel className="font-semibold text-primary py-2">
                          {category.category}
                        </SelectLabel>
                        {category.types.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Country, State and City */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select 
                  value={formData.country} 
                  onValueChange={handleCountryChange}
                  disabled={!isEditing}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border max-h-60 z-50">
                    {allCountries.map((country) => (
                      <SelectItem key={country.isoCode} value={country.name}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state}
                  onValueChange={handleStateChange}
                  disabled={!formData.country || !isEditing}
                >
                  <SelectTrigger id="state">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Select 
                  value={formData.city} 
                  onValueChange={(city) => setFormData({ ...formData, city })}
                  disabled={!formData.country || !formData.state || !isEditing}
                >
                  <SelectTrigger id="city">
                    <SelectValue placeholder={formData.state ? 'Select a city' : 'Select a state first'} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border max-h-60 z-50">
                    {cities.map((city) => (
                      <SelectItem key={city.name} value={city.name}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Business Address and Business Hours side by side */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="business_address">Business Address</Label>
                {isEditing ? (
                  <>
                    <Textarea
                      id="business_address"
                      value={formData.business_address}
                      onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                      placeholder="123 Business St"
                      className="min-h-[96px] max-h-[160px] resize-none overflow-auto"
                    />
                    <p className="text-xs text-muted-foreground">
                      Please enter the full business address including your service area.
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words min-h-[96px]">
                    {formData.business_address || '-'}
                  </div>
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
                          {hour.opensAt === '00:00' && hour.closesAt === '23:59' ? '24 Hours' : `${hour.opensAt} - ${hour.closesAt}`}
                        </span>
                        {isEditing && (
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
                {isEditing && (
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
                          setFormData({ ...formData, hours: [...formData.hours, newHour] });
                          setNewHour({ day: '', opensAt: '', closesAt: '' });
                        }
                      }}
                      disabled={!newHour.day || !newHour.opensAt || !newHour.closesAt}
                      className="px-2"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                inputMode="numeric"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                placeholder="e.g., 10210"
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              {isEditing ? (
                <Input
                  id="website"
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  placeholder="https://yourbusiness.com"
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
              <Label htmlFor="gmb">Google Business Profile Link</Label>
              {isEditing ? (
                <Input
                  id="gmb"
                  value={formData.gmb_link}
                  onChange={(e) => setFormData({ ...formData, gmb_link: e.target.value })}
                  placeholder="https://g.page/..."
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

            {/* Social Media Links */}
            {isEditing ? (
              <SocialMediaInput
                links={formData.social_media_links}
                onChange={(links) => setFormData({ ...formData, social_media_links: links })}
              />
            ) : (
              <div className="space-y-2">
                <Label>Social Media Links</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.social_media_links.length > 0 ? (
                    formData.social_media_links.map((link, index) => (
                      <a
                        key={index}
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
                    <p className="text-muted-foreground">No social media links added</p>
                  )}
                </div>
              </div>
            )}

            {isEditing && (
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Dialog open={marketingSetupOpen} onOpenChange={setMarketingSetupOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl p-0 sm:rounded-lg">
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-border px-6 py-4">
                {/* Leave room for DialogContent's built-in close (X) button */}
                <div className="flex items-start justify-between gap-3 pr-10 sm:pr-12">
                  <DialogHeader className="space-y-0">
                    <DialogTitle className="text-xl">Marketing Setup</DialogTitle>
                    <p className="text-sm text-muted-foreground">Set marketing goal & services/offerings.</p>
                  </DialogHeader>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingMarketingSetup(true)}
                    disabled={isEditingMarketingSetup}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Services / Offerings (Left) */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Services / Offerings</CardTitle>
                      <CardDescription>Describe what you sell and where you serve.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="primary_service">Primary Service*</Label>
                        <Input
                          id="primary_service"
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
                        <Label htmlFor="service_short_desc">Short Description</Label>
                        <Textarea
                          id="service_short_desc"
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
                        <Label htmlFor="service_area">Service Area</Label>
                        <Input
                          id="service_area"
                          value={marketingSetup.serviceArea}
                          onChange={(e) =>
                            setMarketingSetup((prev) => ({
                              ...prev,
                              serviceArea: e.target.value,
                            }))
                          }
                          placeholder="e.g., Los Angeles County, CA"
                          disabled={!isEditingMarketingSetup}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Marketing Goal (Right) */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Marketing Goal</CardTitle>
                      <CardDescription>Pick the main outcome you want.</CardDescription>
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
                              <RadioGroupItem id="goal_calls" value="calls" />
                              <Label htmlFor="goal_calls">Calls</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem id="goal_leads" value="leads" />
                              <Label htmlFor="goal_leads">Leads</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem id="goal_booking" value="booking" />
                              <Label htmlFor="goal_booking">Bookings</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="marketing_goal_text">Goal Details</Label>
                        <Input
                          id="marketing_goal_text"
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

                      <div className="pt-2">
                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleSaveMarketingSetup}
                          disabled={!isEditingMarketingSetup || savingMarketingSetup}
                        >
                          {savingMarketingSetup ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="border-t border-border px-6 py-4 flex justify-end">
                <Button type="button" variant="outline" onClick={() => setMarketingSetupOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle>Business Knowledge Base</CardTitle>
                  <CardDescription>Manage your business knowledge documents</CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleBackToDetails}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="bkb" className="w-full">
              <TabsList className="w-full flex flex-wrap gap-1 h-auto justify-start">
                <TabsTrigger value="bkb" className="text-xs">My BKB</TabsTrigger>
                <TabsTrigger value="be" className="text-xs">Brand Expert</TabsTrigger>
                <TabsTrigger value="persona1" className="text-xs">Persona 1</TabsTrigger>
                <TabsTrigger value="persona2" className="text-xs">Persona 2</TabsTrigger>
                <TabsTrigger value="persona3" className="text-xs">Persona 3</TabsTrigger>
              </TabsList>
              <TabsContent value="bkb" className="mt-6">
                <RichTextEditor
                  title="My Business Knowledge Base (BKB)"
                  description="Core information about your business"
                  value={kbData.bkb}
                  onChange={(value) => setKbData(prev => ({ ...prev, bkb: value }))}
                  onSave={() => handleSaveKB('bkb')}
                  onEdit={() => handleEditKB('bkb')}
                  saving={savingKB}
                  isEditing={kbEditingState.bkb}
                  icon={FileText}
                />
              </TabsContent>
              <TabsContent value="be" className="mt-6">
                <RichTextEditor
                  title="My Brand Expert (BE)"
                  description="Your brand voice and expertise guidelines"
                  value={kbData.brandExpert}
                  onChange={(value) => setKbData(prev => ({ ...prev, brandExpert: value }))}
                  onSave={() => handleSaveKB('brandExpert')}
                  onEdit={() => handleEditKB('brandExpert')}
                  saving={savingKB}
                  isEditing={kbEditingState.brandExpert}
                  icon={User}
                />
              </TabsContent>
              <TabsContent value="persona1" className="mt-6">
                <RichTextEditor
                  title={kbData.persona1Title}
                  description="First target customer persona"
                  value={kbData.persona1}
                  onChange={(value) => setKbData(prev => ({ ...prev, persona1: value }))}
                  onSave={() => handleSaveKB('persona1')}
                  onEdit={() => handleEditKB('persona1')}
                  saving={savingKB}
                  isEditing={kbEditingState.persona1}
                  icon={Users}
                  editableTitle={true}
                  onTitleChange={(newTitle) => handlePersonaTitleChange('persona1Title', newTitle)}
                />
              </TabsContent>
              <TabsContent value="persona2" className="mt-6">
                <RichTextEditor
                  title={kbData.persona2Title}
                  description="Second target customer persona"
                  value={kbData.persona2}
                  onChange={(value) => setKbData(prev => ({ ...prev, persona2: value }))}
                  onSave={() => handleSaveKB('persona2')}
                  onEdit={() => handleEditKB('persona2')}
                  saving={savingKB}
                  isEditing={kbEditingState.persona2}
                  icon={Users}
                  editableTitle={true}
                  onTitleChange={(newTitle) => handlePersonaTitleChange('persona2Title', newTitle)}
                />
              </TabsContent>
              <TabsContent value="persona3" className="mt-6">
                <RichTextEditor
                  title={kbData.persona3Title}
                  description="Third target customer persona"
                  value={kbData.persona3}
                  onChange={(value) => setKbData(prev => ({ ...prev, persona3: value }))}
                  onSave={() => handleSaveKB('persona3')}
                  onEdit={() => handleEditKB('persona3')}
                  saving={savingKB}
                  isEditing={kbEditingState.persona3}
                  icon={Users}
                  editableTitle={true}
                  onTitleChange={(newTitle) => handlePersonaTitleChange('persona3Title', newTitle)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
