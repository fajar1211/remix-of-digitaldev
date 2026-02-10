import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { businessTypeCategories } from '@/data/businessTypes';
import { findCountryByName, findStateByName, getAllCountries, getCitiesOfState, getStatesOfCountry } from '@/lib/locations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useBusinessTypes } from '@/hooks/useBusinessTypes';

export default function BusinessBasics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const allCountries = getAllCountries();
  const { categories: businessTypesFromDb } = useBusinessTypes({ fallback: businessTypeCategories });
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    country: '',
    state: '',
    city: '',
    phoneCode: '',
    phoneNumber: '',
  });
  const [businessId, setBusinessId] = useState('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedBusinessId = sessionStorage.getItem('onboarding_businessId');
    if (storedBusinessId) {
      setBusinessId(storedBusinessId);
    }

    // Prefill from previous step (when user clicks Back)
    const businessName = sessionStorage.getItem('onboarding_businessName') ?? '';
    const businessType = sessionStorage.getItem('onboarding_businessType') ?? '';
    const country = sessionStorage.getItem('onboarding_country') ?? '';
    const state = sessionStorage.getItem('onboarding_state') ?? '';
    const city = sessionStorage.getItem('onboarding_city') ?? '';
    const phoneStored = sessionStorage.getItem('onboarding_phoneNumber') ?? '';

    let phoneCode = '';
    let phoneNumber = '';
    const m = phoneStored.match(/^(\+\d+)\s*(.*)$/);
    if (m) {
      phoneCode = m[1] ?? '';
      phoneNumber = (m[2] ?? '').trim();
    } else {
      phoneNumber = phoneStored;
    }

    setFormData((prev) => ({
      ...prev,
      businessName,
      businessType,
      country,
      state,
      city,
      phoneCode: phoneCode || prev.phoneCode,
      phoneNumber,
    }));
  }, []);

  useEffect(() => {
    if (formData.country) {
      const country = findCountryByName(formData.country);
      const states = country ? getStatesOfCountry(country.isoCode).map((s) => s.name) : [];
      setAvailableStates(states);
      setAvailableCities([]);

      // Auto-set phone code when country changes
      const nextPhoneCode = country?.phoneCode;
      setFormData((prev) => ({
        ...prev,
        state: '',
        city: '',
        phoneCode: prev.phoneCode || nextPhoneCode || '',
      }));
    }
  }, [formData.country]);

  useEffect(() => {
    if (!formData.country || !formData.state) {
      setAvailableCities([]);
      return;
    }
    const country = findCountryByName(formData.country);
    if (!country) {
      setAvailableCities([]);
      return;
    }
    const st = findStateByName(country.isoCode, formData.state);
    const cities = st ? getCitiesOfState(country.isoCode, st.isoCode).map((c) => c.name) : [];
    setAvailableCities(cities);
  }, [formData.country, formData.state]);

  const isFormValid = 
    formData.businessName.trim() && 
    formData.businessType && 
    formData.country && 
    formData.phoneNumber.trim();

  const handleContinue = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to continue.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine phone code and number
      const fullPhoneNumber = `${formData.phoneCode} ${formData.phoneNumber}`.trim();

      // Store in sessionStorage for use in later steps
      sessionStorage.setItem('onboarding_businessName', formData.businessName.trim());
      sessionStorage.setItem('onboarding_businessType', formData.businessType);
      sessionStorage.setItem('onboarding_country', formData.country);
      sessionStorage.setItem('onboarding_state', formData.state);
      sessionStorage.setItem('onboarding_city', formData.city);
      sessionStorage.setItem('onboarding_phoneNumber', fullPhoneNumber);

      // Get other onboarding data already collected
      const firstName = sessionStorage.getItem('onboarding_firstName') || '';
      const lastName = sessionStorage.getItem('onboarding_lastName') || '';
      const businessStage = sessionStorage.getItem('onboarding_businessStage') || 'new';

      // Check if business already exists for this user
      const { data: existingBusiness } = await (supabase
        .from('businesses')
        .select('id, business_number')
        .eq('user_id', user.id)
        .maybeSingle() as any);

      const businessData: any = {
        user_id: user.id,
        first_name: firstName || null,
        last_name: lastName || null,
        business_name: formData.businessName.trim() || null,
        business_type: formData.businessType || null,
        country: formData.country || null,
        state: formData.state || null,
        city: formData.city || null,
        phone_number: fullPhoneNumber || null,
        email: user.email || null,
        stage: businessStage,
        onboarding_completed: false,
      };

      let businessError;
      let businessNumber: number | null = existingBusiness?.business_number ?? null;

      if (existingBusiness) {
        const { data: updatedBusiness, error } = await (supabase
          .from('businesses')
          .update(businessData)
          .eq('user_id', user.id)
          .select('business_number')
          .maybeSingle() as any);
        businessError = error;
        if (updatedBusiness?.business_number) {
          businessNumber = updatedBusiness.business_number;
        }
      } else {
        const { data: newBusiness, error } = await (supabase
          .from('businesses')
          .insert(businessData)
          .select('business_number')
          .maybeSingle() as any);
        businessError = error;
        if (newBusiness?.business_number) {
          businessNumber = newBusiness.business_number;
        }
      }

      if (businessError) {
        console.error('Business error:', businessError);
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            (businessError as any)?.message
              ? `Failed to save business info: ${(businessError as any).message}`
              : 'Failed to save business info. Please try again.',
        });
        setIsSubmitting(false);
        return;
      }

      if (businessNumber) {
        const generatedBusinessId = `B${businessNumber.toString().padStart(5, '0')}`;
        setBusinessId(generatedBusinessId);
        sessionStorage.setItem('onboarding_businessId', generatedBusinessId);
      }

      navigate('/onboarding/online-presence');
    } catch (error) {
      console.error('Unexpected error saving business:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique phone codes for dropdown
  const phoneCodes = [...new Set(allCountries.map((c) => c.phoneCode).filter(Boolean))].sort() as string[];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/onboarding/business-stage')}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2">
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-muted" />
          <div className="h-2 w-8 rounded-full bg-muted" />
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <div className="text-sm font-medium text-primary mb-2">STEP 2</div>
            <CardTitle className="text-2xl">Business Basics</CardTitle>
            <CardDescription>
              Tell us about your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="businessId">Business ID</Label>
              <Input
                id="businessId"
                value={businessId || 'Will be generated after you complete setup'}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name <span className="text-destructive">*</span></Label>
              <Input
                id="businessName"
                placeholder="My Awesome Business"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Business Type <span className="text-destructive">*</span></Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => setFormData({ ...formData, businessType: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {businessTypesFromDb.map((category) => (
                    <SelectGroup key={category.category}>
                      <SelectLabel className="font-semibold text-foreground">{category.category}</SelectLabel>
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

            <div className="space-y-2">
              <Label>Country <span className="text-destructive">*</span></Label>
              <Select
                value={formData.country}
                onValueChange={(value) => setFormData({ ...formData, country: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {allCountries.map((country) => (
                    <SelectItem key={country.isoCode} value={country.name}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={formData.state}
                onValueChange={(value) => setFormData({ ...formData, state: value, city: '' })}
                disabled={!formData.country}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={formData.country ? 'Select state' : 'Select country first'} />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {availableStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Select
                value={formData.city}
                onValueChange={(value) => setFormData({ ...formData, city: value })}
                disabled={!formData.country || !formData.state}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={formData.state ? 'Select city' : 'Select state first'} />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {availableCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Select
                  value={formData.phoneCode}
                  onValueChange={(value) => setFormData({ ...formData, phoneCode: value })}
                >
                  <SelectTrigger className="w-[100px] bg-background">
                    <SelectValue placeholder="+1" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border z-50 max-h-[300px]">
                    {phoneCodes.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="phoneNumber"
                  placeholder="234 567 8900"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <Button
              size="lg"
              className="w-full mt-4"
              disabled={!isFormValid || isSubmitting}
              onClick={handleContinue}
            >
              Next Step
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
