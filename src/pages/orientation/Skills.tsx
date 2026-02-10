import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const SKILLS = [
  'Google Business Profile (GMB)',
  'Local SEO',
  'Content Writing',
  'Social Media Posting',
  'Review Management',
  'Website (WordPress)',
  'Lead / Review Follow-up Calls',
  'Automation / AI Tools',
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function OrientationSkills() {
  const navigate = useNavigate();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('');

  // Load from sessionStorage on mount
  useEffect(() => {
    const savedSkills = sessionStorage.getItem('orientation_skills');
    const savedExperience = sessionStorage.getItem('orientation_experience');
    if (savedSkills) setSelectedSkills(JSON.parse(savedSkills));
    if (savedExperience) setExperienceLevel(savedExperience);
  }, []);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleNext = () => {
    sessionStorage.setItem('orientation_skills', JSON.stringify(selectedSkills));
    sessionStorage.setItem('orientation_experience', experienceLevel);
    navigate('/orientation/portfolio');
  };

  const handleSkip = () => {
    sessionStorage.setItem('orientation_skills', JSON.stringify([]));
    sessionStorage.setItem('orientation_experience', '');
    navigate('/orientation/portfolio');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/orientation/profile')}
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
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <div className="text-sm font-medium text-primary mb-2">STEP 2</div>
            <CardTitle className="text-2xl">Skills & Expertise</CardTitle>
            <CardDescription>
              Select your skills and experience level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Skills Multi-Select */}
            <div className="space-y-3">
              <Label>Select Skills (Multi-select)</Label>
              <div className="grid grid-cols-1 gap-2">
                {SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      selectedSkills.includes(skill)
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border bg-background hover:border-primary/50 text-muted-foreground'
                    }`}
                  >
                    <span className="text-sm font-medium">{skill}</span>
                    {selectedSkills.includes(skill) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-3">
              <Label>Experience Level</Label>
              <RadioGroup
                value={experienceLevel}
                onValueChange={setExperienceLevel}
                className="grid grid-cols-3 gap-3"
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <div key={level.value}>
                    <RadioGroupItem
                      value={level.value}
                      id={level.value}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={level.value}
                      className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${
                        experienceLevel === level.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border bg-background hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      <span className="text-sm font-medium">{level.label}</span>
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={handleSkip}
              >
                Skip
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={handleNext}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
