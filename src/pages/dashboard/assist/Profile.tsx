import { useMemo, useState, useEffect, useRef } from 'react';
import { User, Camera, Save, Pencil, X, Globe, Linkedin, Twitter, Briefcase, MapPin, Plus, Facebook, Instagram, Youtube, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { LocationSelectFields } from '@/components/location/LocationSelectFields';
import { findCountryByName, getAllCountries } from '@/lib/locations';

interface SocialLink {
  platform: string;
  url: string;
}

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  phoneCode: string;
  phoneNumber: string;
  avatar_url: string;
  bio: string;
  portfolio_url: string;
  skills: string[];
  experience: string;
  linkedin_url: string;
  twitter_url: string;
  location: string;
  state: string;
  city: string;
  specialization: string;
  social_links: SocialLink[];
}

const socialPlatforms = [
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'twitter', label: 'X/Twitter', icon: Twitter },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'tiktok', label: 'TikTok', icon: Globe },
];

export default function AssistProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newSocialPlatform, setNewSocialPlatform] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');
  
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
    phoneCode: '',
    phoneNumber: '',
    avatar_url: '',
    bio: '',
    portfolio_url: '',
    skills: [],
    experience: '',
    linkedin_url: '',
    twitter_url: '',
    location: '',
    state: '',
    city: '',
    specialization: '',
    social_links: [],
  });
  const [assistId, setAssistId] = useState('');

  const allCountries = useMemo(() => getAllCountries(), []);
  const phoneCodes = useMemo(
    () => [...new Set(allCountries.map((c) => c.phoneCode).filter(Boolean) as string[])].sort(),
    [allCountries],
  );

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const fullPhone = (data as any).phone || '';
        let phoneCode = '';
        let phoneNumber = fullPhone;
        const phoneMatch = fullPhone.match(/^(\+\d+)\s*(.*)$/);
        if (phoneMatch) {
          phoneCode = phoneMatch[1];
          phoneNumber = phoneMatch[2];
        }

        // Prefer orientation/profile data (country & city) when available
        const extendedProfile = data as typeof data & {
          country?: string | null;
          state?: string | null;
          city?: string | null;
        };

        const fullLocation = (data as any).location || '';
        let savedCountry = extendedProfile.country || '';
        const savedState = extendedProfile.state || '';
        let savedCity = extendedProfile.city || '';

        if (!savedCountry) {
          if (fullLocation.includes(', ')) {
            const parts = fullLocation.split(', ');
            savedCity = parts[0];
            savedCountry = parts.slice(1).join(', ');
          } else {
            savedCountry = fullLocation;
          }
        }

        // Parse social_links from database
        let savedSocialLinks: SocialLink[] = [];
        if (Array.isArray((data as any).social_links)) {
          savedSocialLinks = (data as any).social_links;
        }

        setProfile({
          name: (data as any).name || '',
          email: (data as any).email || '',
          phone: (data as any).phone || '',
          phoneCode,
          phoneNumber,
          avatar_url: (data as any).avatar_url || '',
          bio: (data as any).bio || '',
          portfolio_url: (data as any).portfolio_url || '',
          skills: (data as any).skills || [],
          experience: (data as any).experience || '',
          linkedin_url: (data as any).linkedin_url || '',
          twitter_url: (data as any).twitter_url || '',
          location: savedCountry,
          state: savedState,
          city: savedCity,
          specialization: (data as any).specialization || '',
          social_links: savedSocialLinks,
        });
      }

      const idNum = parseInt(user.id.slice(-4), 16) % 900 + 100;
      setAssistId(`A${String(idNum).padStart(5, '0')}`);

      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const locationSchema = z.object({
        country: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        city: z.string().trim().max(100).optional(),
      });

      const parsed = locationSchema.safeParse({
        country: profile.location || undefined,
        state: profile.state || undefined,
        city: profile.city || undefined,
      });
      if (!parsed.success) throw new Error('Invalid location values');

      const fullPhone = `${profile.phoneCode} ${profile.phoneNumber}`.trim();
      
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          email: profile.email,
          phone: fullPhone,
          portfolio_url: profile.portfolio_url,
          skills: profile.skills,
          linkedin_url: profile.linkedin_url,
          twitter_url: profile.twitter_url,
          country: profile.location,
          state: profile.state,
          city: profile.city,
          avatar_url: profile.avatar_url,
          social_links: profile.social_links,
        } as any)
        .eq('id', user.id);

      if (error) throw error;

      setIsEditing(false);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved successfully.',
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const filePath = `${user.id}/avatar/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('user-files')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
      
      await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl } as any)
        .eq('id', user.id);

      toast({ title: 'Avatar Uploaded' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setProfile(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const handleAddSocialLink = () => {
    if (newSocialPlatform && newSocialUrl.trim()) {
      setProfile(prev => ({
        ...prev,
        social_links: [...prev.social_links, { platform: newSocialPlatform, url: newSocialUrl.trim() }]
      }));
      setNewSocialPlatform('');
      setNewSocialUrl('');
    }
  };

  const handleRemoveSocialLink = (index: number) => {
    setProfile(prev => ({
      ...prev,
      social_links: prev.social_links.filter((_, i) => i !== index)
    }));
  };

  const handleCountryChange = (country: string) => {
    const countryData = findCountryByName(country);
    setProfile(prev => ({
      ...prev,
      location: country,
      state: '',
      city: '',
      phoneCode: countryData?.phoneCode || prev.phoneCode,
    }));
  };

  const handleStateChange = (state: string) => {
    setProfile((prev) => ({ ...prev, state, city: '' }));
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
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground">Manage your assist account profile</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Your account details and portfolio</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-2" />Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Edit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {profile.name?.charAt(0)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <Button size="icon" variant="secondary" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Camera className="h-4 w-4" />
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <div>
              <h3 className="font-medium text-lg">{profile.name}</h3>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Assist ID</Label>
              <Input value={assistId} disabled className="bg-muted font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              {isEditing ? (
                <Input
                  value={profile.email}
                  onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                />
              ) : (
                <p className="py-2 font-medium">{profile.email || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.name} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Select value={profile.phoneCode} onValueChange={(v) => setProfile(prev => ({ ...prev, phoneCode: v }))}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneCodes.map((code) => {
                        const country = allCountries.find((c) => c.phoneCode === code);
                        return (
                          <SelectItem key={code} value={code}>
                            <span className="flex items-center gap-2">
                              <span className="text-lg">
                                {country?.isoCode === 'US' ? '🇺🇸' : country?.isoCode === 'GB' ? '🇬🇧' : country?.isoCode === 'ID' ? '🇮🇩' : '🌐'}
                              </span>
                              {code}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input value={profile.phoneNumber} onChange={(e) => setProfile(prev => ({ ...prev, phoneNumber: e.target.value }))} placeholder="Phone number" className="flex-1" />
                </div>
              ) : (
                <p className="py-2 font-medium">{profile.phone || '-'}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />Location
              </Label>
              {isEditing ? (
                <LocationSelectFields
                  country={profile.location}
                  state={profile.state}
                  city={profile.city}
                  onCountryChange={handleCountryChange}
                  onStateChange={handleStateChange}
                  onCityChange={(c) => setProfile((prev) => ({ ...prev, city: c }))}
                  className="grid gap-6 md:grid-cols-3"
                />
              ) : (
                <div className="grid gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Country:</span> <span className="font-medium">{profile.location || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">State:</span> <span className="font-medium">{profile.state || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">City:</span> <span className="font-medium">{profile.city || '-'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                  {skill}
                  {isEditing && <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveSkill(skill)} />}
                </Badge>
              ))}
            </div>
            {isEditing && (
              <div className="flex gap-2">
                <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add skill..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())} />
                <Button variant="outline" onClick={handleAddSkill}>Add</Button>
              </div>
            )}
          </div>

          {/* Portfolio & Links */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Globe className="h-4 w-4" />Portfolio URL</Label>
            {isEditing ? (
              <Input value={profile.portfolio_url} onChange={(e) => setProfile(prev => ({ ...prev, portfolio_url: e.target.value }))} placeholder="https://..." />
            ) : profile.portfolio_url ? (
              <a 
                href={profile.portfolio_url.startsWith('http') ? profile.portfolio_url : `https://${profile.portfolio_url}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="py-2 text-primary hover:underline flex items-center gap-2"
              >
                {profile.portfolio_url}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <p className="py-2 text-muted-foreground">-</p>
            )}
          </div>

          {/* Social Media with Add Button */}
          <div className="space-y-2">
            <Label>Social Media</Label>
            <div className="space-y-2">
              {profile.social_links.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant="outline">{socialPlatforms.find(p => p.value === link.platform)?.label || link.platform}</Badge>
                  {isEditing ? (
                    <>
                      <span className="flex-1 text-sm truncate">{link.url}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveSocialLink(index)}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <a 
                      href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {link.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            {isEditing && (
              <div className="flex gap-2 mt-2">
                <Select value={newSocialPlatform} onValueChange={setNewSocialPlatform}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
                  <SelectContent>
                    {socialPlatforms.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)} placeholder="URL" className="flex-1" />
                <Button variant="outline" onClick={handleAddSocialLink}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
