import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  findCountryByName,
  findStateByName,
  getAllCountries,
  getCitiesOfState,
  getStatesOfCountry,
  type LocationCountry,
  type LocationState,
} from '@/lib/locations';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function OrientationProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assistId, setAssistId] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    phoneCode: '',
    phoneNumber: '',
    country: '',
    state: '',
    city: '',
  });
  const [availableStates, setAvailableStates] = useState<LocationState[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const syncOrientationSession = (data: typeof formData) => {
    // Keep legacy keys for compatibility, but treat firstName as "Full Name" for assist.
    sessionStorage.setItem('orientation_fullName', data.firstName.trim());
    sessionStorage.setItem('orientation_firstName', data.firstName.trim());
    sessionStorage.setItem('orientation_lastName', '');
    sessionStorage.setItem('orientation_age', data.age);
    sessionStorage.setItem(
      'orientation_phone',
      `${data.phoneCode} ${data.phoneNumber}`.trim()
    );
    sessionStorage.setItem('orientation_country', data.country);
    sessionStorage.setItem('orientation_state', data.state);
    sessionStorage.setItem('orientation_city', data.city);
  };

  const ageOptions = Array.from({ length: 48 }, (_, i) => (i + 18).toString());

  // Fetch profile data and merge with any saved orientation progress
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get assist ID (auto-generated, read-only)
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'assist')
          .single();

        if (roleData) {
          const formattedId = `A${String(roleData.id).padStart(5, '0')}`;
          setAssistId(formattedId);
        }

        // Prepare base profile values
        let firstName = '';
        let lastName = '';
        let age = '';
        let phoneCode = '';
        let phoneNumber = '';
        let country = '';
        let state = '';
        let city = '';

        // Get profile data from backend
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          // Use the stored profile name as Full Name
          firstName = (profileData.name || '').trim();
          lastName = '';

          // Parse phone
          const phoneParts = (profileData.phone || '').match(/^(\+\d+)\s*(.*)$/);
          phoneCode = phoneParts?.[1] || '';
          phoneNumber = phoneParts?.[2] || '';

          // Cast to get extended fields (age, country, city added via migration)
          const extendedProfile = profileData as typeof profileData & {
            age?: number | null;
            country?: string | null;
             state?: string | null;
            city?: string | null;
          };

          age = extendedProfile.age?.toString() || '';
          country = extendedProfile.country || '';
           state = extendedProfile.state || '';
          city = extendedProfile.city || '';
        }

        // Override with any saved orientation progress in sessionStorage
        const sessionFullName = sessionStorage.getItem('orientation_fullName');
        const sessionFirstName = sessionStorage.getItem('orientation_firstName');
        const sessionLastName = sessionStorage.getItem('orientation_lastName');
        const sessionAge = sessionStorage.getItem('orientation_age');
        const sessionPhone = sessionStorage.getItem('orientation_phone');
        const sessionCountry = sessionStorage.getItem('orientation_country');
        const sessionState = sessionStorage.getItem('orientation_state');
        const sessionCity = sessionStorage.getItem('orientation_city');

        if (sessionFullName !== null) firstName = sessionFullName;
        else if (sessionFirstName !== null) firstName = sessionFirstName;
        if (sessionLastName !== null) lastName = sessionLastName;
        if (sessionAge !== null) age = sessionAge;
        if (sessionCountry !== null) country = sessionCountry;
        if (sessionState !== null) state = sessionState;
        if (sessionCity !== null) city = sessionCity;

        if (sessionPhone) {
          const phoneParts = sessionPhone.match(/^(\+\d+)\s*(.*)$/);
          phoneCode = phoneParts?.[1] || phoneCode;
          phoneNumber = phoneParts?.[2] || phoneNumber;
        }

        const mergedData = {
          firstName,
          lastName: '',
          age,
          phoneCode,
          phoneNumber,
          country,
          state,
          city,
        };

        setFormData(mergedData);
        syncOrientationSession(mergedData);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);


  // Update states/cities when country changes
  useEffect(() => {
    const selectedCountry = formData.country ? findCountryByName(formData.country) : undefined;

    if (!selectedCountry) {
      setAvailableStates([]);
      setAvailableCities([]);
      if (formData.country || formData.state || formData.city) {
        const updated = { ...formData, country: formData.country, state: '', city: '' };
        setFormData(updated);
        syncOrientationSession(updated);
      }
      return;
    }

    const states = getStatesOfCountry(selectedCountry.isoCode);
    setAvailableStates(states);

    // Ensure state is valid for selected country
    const validState = formData.state
      ? findStateByName(selectedCountry.isoCode, formData.state)
      : undefined;

    const nextState = validState ? formData.state : '';
    const nextCity = validState ? formData.city : '';

    const nextPhoneCode = formData.phoneCode || selectedCountry.phoneCode || '';

    const updated = {
      ...formData,
      phoneCode: nextPhoneCode,
      state: nextState,
      city: nextCity,
    };

    if (
      updated.phoneCode !== formData.phoneCode ||
      updated.state !== formData.state ||
      updated.city !== formData.city
    ) {
      setFormData(updated);
      syncOrientationSession(updated);
    } else {
      syncOrientationSession(formData);
    }
  }, [formData.country]);

  // Update cities when state changes
  useEffect(() => {
    const selectedCountry = formData.country ? findCountryByName(formData.country) : undefined;
    if (!selectedCountry || !formData.state) {
      setAvailableCities([]);
      if (formData.city) {
        const updated = { ...formData, city: '' };
        setFormData(updated);
        syncOrientationSession(updated);
      }
      return;
    }

    const selectedState = findStateByName(selectedCountry.isoCode, formData.state);
    if (!selectedState) {
      setAvailableCities([]);
      if (formData.city) {
        const updated = { ...formData, city: '' };
        setFormData(updated);
        syncOrientationSession(updated);
      }
      return;
    }

    const cities = getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((c) => c.name);
    setAvailableCities(cities);

    if (formData.city && !cities.includes(formData.city)) {
      const updated = { ...formData, city: '' };
      setFormData(updated);
      syncOrientationSession(updated);
    } else {
      syncOrientationSession(formData);
    }
  }, [formData.country, formData.state]);


  const isFormValid = 
    formData.firstName.trim() &&
    formData.age &&
    formData.phoneNumber.trim() &&
    formData.country &&
    formData.state &&
    formData.city;

  const handleContinue = () => {
    // Store data in sessionStorage
    sessionStorage.setItem('orientation_fullName', formData.firstName.trim());
    sessionStorage.setItem('orientation_firstName', formData.firstName.trim());
    sessionStorage.setItem('orientation_lastName', '');
    sessionStorage.setItem('orientation_age', formData.age);
    sessionStorage.setItem('orientation_phone', `${formData.phoneCode} ${formData.phoneNumber}`.trim());
    sessionStorage.setItem('orientation_country', formData.country);
    sessionStorage.setItem('orientation_state', formData.state);
    sessionStorage.setItem('orientation_city', formData.city);
    navigate('/orientation/skills');
  };

  const allCountries = getAllCountries();
  const phoneCodes = [...new Set(allCountries.map((c) => c.phoneCode).filter(Boolean) as string[])].sort();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/orientation/welcome')}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2">
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-muted" />
          <div className="h-2 w-8 rounded-full bg-muted" />
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <div className="text-sm font-medium text-primary mb-2">STEP 1</div>
            <CardTitle className="text-2xl">Assistant Profile</CardTitle>
            <CardDescription>
              Complete your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Assistant ID - Read Only */}
            <div className="space-y-2">
              <Label>Assistant ID</Label>
              <Input
                value={assistId}
                disabled
                className="bg-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">Auto-generated, cannot be edited</p>
            </div>

            <div className="space-y-2">
              <Label>
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.firstName}
                onChange={(e) => {
                  const updated = { ...formData, firstName: e.target.value, lastName: '' };
                  setFormData(updated);
                  syncOrientationSession(updated);
                }}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Auto-filled from signup; you can edit it here.</p>
            </div>

            <div className="space-y-2">
              <Label>Age <span className="text-destructive">*</span></Label>
              <Select
                value={formData.age}
                onValueChange={(value) => {
                  const updated = { ...formData, age: value };
                  setFormData(updated);
                  syncOrientationSession(updated);
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select your age" />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {ageOptions.map((age) => (
                    <SelectItem key={age} value={age}>
                      {age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Country <span className="text-destructive">*</span></Label>
              <Select
                value={formData.country}
                onValueChange={(value) => {
                  const updated = { ...formData, country: value, state: '', city: '' };
                  setFormData(updated);
                  syncOrientationSession(updated);
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {allCountries.map((country: LocationCountry) => (
                    <SelectItem key={country.isoCode} value={country.name}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>State <span className="text-destructive">*</span></Label>
              <Select
                value={formData.state}
                onValueChange={(value) => {
                  const updated = { ...formData, state: value, city: '' };
                  setFormData(updated);
                  syncOrientationSession(updated);
                }}
                disabled={!formData.country}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={formData.country ? "Select state" : "Select country first"} />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50 max-h-[300px]">
                  {availableStates.map((s) => (
                    <SelectItem key={s.isoCode} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>City <span className="text-destructive">*</span></Label>
              <Select
                value={formData.city}
                onValueChange={(value) => {
                  const updated = { ...formData, city: value };
                  setFormData(updated);
                  syncOrientationSession(updated);
                }}
                disabled={!formData.state}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={formData.state ? "Select city" : "Select state first"} />
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
              <Label>Phone Number <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Select
                  value={formData.phoneCode}
                  onValueChange={(value) => {
                    const updated = { ...formData, phoneCode: value };
                    setFormData(updated);
                    syncOrientationSession(updated);
                  }}
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
                  placeholder="234 567 8900"
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    const updated = { ...formData, phoneNumber: e.target.value };
                    setFormData(updated);
                    syncOrientationSession(updated);
                  }}
                  className="flex-1"
                />
              </div>
            </div>


            <Button
              size="lg"
              className="w-full mt-4"
              disabled={!isFormValid}
              onClick={handleContinue}
            >
              Next
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
