import { useRef, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Edit,
  Save,
  Link,
  Unlink,
  Table,
  Undo,
  Redo,
  Type,
  Palette,
  Highlighter,
  Quote,
  Code,
  Minus,
  Subscript,
  Superscript,
  RemoveFormatting,
  Copy,
  Check,
  Pencil,
  Image,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { WebsiteMediaPickerDialog } from '@/components/media/WebsiteMediaPickerDialog';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onEdit?: () => void;
  saving?: boolean;
  isEditing?: boolean;
  title: string;
  description: string;
  icon: React.ElementType;
  editableTitle?: boolean;
  onTitleChange?: (newTitle: string) => void;
  /** Hide the entire header row (icon + title/description + buttons). */
  showTopBar?: boolean;
  /** Hide the Copy/Edit/Save buttons in the header row (keeps title/description). */
  showSaveControls?: boolean;
  /** Enable image tools: upload / pick from Media Library and insert into content. */
  enableImageInsert?: boolean;
}


const fontFamilies = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Impact', label: 'Impact' },
];

const fontSizes = [
  { value: '1', label: '8pt' },
  { value: '2', label: '10pt' },
  { value: '3', label: '12pt' },
  { value: '4', label: '14pt' },
  { value: '5', label: '18pt' },
  { value: '6', label: '24pt' },
  { value: '7', label: '36pt' },
];

const colors = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
];

export function RichTextEditor({
  value,
  onChange,
  onSave,
  onEdit,
  saving = false,
  isEditing = true,
  title,
  description,
  icon: Icon,
  editableTitle = false,
  onTitleChange,
  showTopBar = true,
  showSaveControls = true,
  enableImageInsert = false,
}: RichTextEditorProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSelectionRangeRef = useRef<Range | null>(null);
  const lastSelectionInsideRef = useRef(false);

  const [linkUrl, setLinkUrl] = useState('');
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');
  const [copied, setCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [selectionInEditor, setSelectionInEditor] = useState(false);
  const [activeBlock, setActiveBlock] = useState<string>('p');

  const normalizeFormatBlock = (raw: string) => raw.toLowerCase().replace(/[<>]/g, '').trim();

  const captureSelectionIfInsideEditor = () => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const node = sel.anchorNode;
    const inside = !!(node && el.contains(node));
    if (!inside) return;

    lastSelectionInsideRef.current = true;
    lastSelectionRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    const range = lastSelectionRangeRef.current;
    if (!el || !range) return;

    const sel = window.getSelection();
    if (!sel) return;

    el.focus();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const refreshSelectionState = () => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      // Keep the buttons enabled if we have a last-known selection in the editor
      setSelectionInEditor(lastSelectionInsideRef.current);
      return;
    }

    const node = sel.anchorNode;
    const inside = !!(node && el.contains(node));

    if (inside) {
      captureSelectionIfInsideEditor();
    }

    setSelectionInEditor(inside || lastSelectionInsideRef.current);

    if (inside) {
      const fmt = (document.queryCommandValue('formatBlock') as string) || 'p';
      setActiveBlock(normalizeFormatBlock(fmt));
    }
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    const handler = () => {
      captureSelectionIfInsideEditor();
      refreshSelectionState();
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const execCommand = (command: string, commandValue?: string) => {
    // Toolbar click can steal focus; restore the last selection inside editor first.
    restoreSelection();
    document.execCommand(command, false, commandValue);
    updateContent();
    refreshSelectionState();
  };


  const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const insertImageAtCursor = (url: string, alt?: string) => {
    const safeUrl = url.trim();
    if (!safeUrl) return;

    // Use insertHTML to control attributes
    const html = `<img src="${escapeAttr(safeUrl)}" alt="${escapeAttr(alt || '')}" loading="lazy" />`;
    execCommand('insertHTML', html);
  };

  const updateContent = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    updateContent();
  };

  const insertLink = () => {
    if (linkUrl) {
      execCommand('createLink', linkUrl);
      setLinkUrl('');
    }
  };

  const insertTable = () => {
    const rows = parseInt(tableRows) || 3;
    const cols = parseInt(tableCols) || 3;
    
    let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
    for (let i = 0; i < rows; i++) {
      tableHTML += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHTML += '<td style="border: 1px solid #ccc; padding: 8px; min-width: 50px;">&nbsp;</td>';
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</table><p></p>';
    
    execCommand('insertHTML', tableHTML);
  };

  const insertHorizontalRule = () => {
    execCommand('insertHorizontalRule');
  };

  const handleEditClick = () => {
    if (onEdit) {
      onEdit();
    }
  };

  const handleCopy = async () => {
    if (editorRef.current) {
      const textContent = editorRef.current.innerText || editorRef.current.textContent || '';
      try {
        await navigator.clipboard.writeText(textContent);
        setCopied(true);
        toast({
          title: 'Copied!',
          description: 'Content copied to clipboard.',
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to copy content.',
        });
      }
    }
  };

  const handleTitleSave = () => {
    if (onTitleChange && localTitle.trim()) {
      onTitleChange(localTitle.trim());
    }
    setEditingTitle(false);
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background p-4 flex flex-col' : 'space-y-4'}>
      {showTopBar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              {editableTitle && editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    className="h-8 text-sm font-semibold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') {
                        setLocalTitle(title);
                        setEditingTitle(false);
                      }
                    }}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={handleTitleSave}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{title}</h3>
                  {editableTitle && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setEditingTitle(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {showSaveControls && (
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant={isEditing ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleEditClick}
                disabled={isEditing}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving || !isEditing}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div
        className={`border rounded-lg bg-background overflow-hidden ${isFullscreen ? 'flex-1 flex flex-col shadow-lg' : ''}`}
      >
        {/* Toolbar */}
        <div
          className={`border-b p-2 flex flex-wrap items-center gap-1 bg-muted/30 transition-opacity ${!isEditing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Undo/Redo */}
          <Toggle size="sm" aria-label="Undo" onPressedChange={() => execCommand('undo')}>
            <Undo className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Redo" onPressedChange={() => execCommand('redo')}>
            <Redo className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Font Family */}
          <Select onValueChange={(val) => execCommand('fontName', val)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border z-50">
              {fontFamilies.map((font) => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Font Size */}
          <Select onValueChange={(val) => execCommand('fontSize', val)}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border z-50">
              {fontSizes.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Text formatting */}
          <Toggle size="sm" aria-label="Bold" onPressedChange={() => execCommand('bold')}>
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Italic" onPressedChange={() => execCommand('italic')}>
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Underline" onPressedChange={() => execCommand('underline')}>
            <Underline className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Strikethrough" onPressedChange={() => execCommand('strikeThrough')}>
            <Strikethrough className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Subscript" onPressedChange={() => execCommand('subscript')}>
            <Subscript className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Superscript" onPressedChange={() => execCommand('superscript')}>
            <Superscript className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Text Color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 bg-background border border-border z-50">
              <Label className="text-xs mb-2 block">Text Color</Label>
              <div className="grid grid-cols-10 gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => execCommand('foreColor', color)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Highlight Color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Highlighter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 bg-background border border-border z-50">
              <Label className="text-xs mb-2 block">Highlight Color</Label>
              <div className="grid grid-cols-10 gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => execCommand('hiliteColor', color)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Headings */}
          <Toggle
            size="sm"
            aria-label="Heading 1"
            title="Heading 1"
            pressed={selectionInEditor && activeBlock === 'h1'}
            disabled={!isEditing}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand('formatBlock', '<h1>');
            }}
            onPressedChange={() => {
              // noop (handled in onMouseDown to preserve selection)
            }}
          >
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            aria-label="Heading 2"
            title="Heading 2"
            pressed={selectionInEditor && activeBlock === 'h2'}
            disabled={!isEditing}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand('formatBlock', '<h2>');
            }}
            onPressedChange={() => {
              // noop
            }}
          >
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            aria-label="Heading 3"
            title="Heading 3"
            pressed={selectionInEditor && activeBlock === 'h3'}
            disabled={!isEditing}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand('formatBlock', '<h3>');
            }}
            onPressedChange={() => {
              // noop
            }}
          >
            <Heading3 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            aria-label="Paragraph"
            title="Paragraph"
            pressed={selectionInEditor && (activeBlock === 'p' || activeBlock === 'div')}
            disabled={!isEditing}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand('formatBlock', '<p>');
            }}
            onPressedChange={() => {
              // noop
            }}
          >
            <Type className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Alignment */}
          <Toggle size="sm" aria-label="Align Left" onPressedChange={() => execCommand('justifyLeft')}>
            <AlignLeft className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Align Center" onPressedChange={() => execCommand('justifyCenter')}>
            <AlignCenter className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Align Right" onPressedChange={() => execCommand('justifyRight')}>
            <AlignRight className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Justify" onPressedChange={() => execCommand('justifyFull')}>
            <AlignJustify className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Lists */}
          <Toggle size="sm" aria-label="Bullet List" onPressedChange={() => execCommand('insertUnorderedList')}>
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Numbered List" onPressedChange={() => execCommand('insertOrderedList')}>
            <ListOrdered className="h-4 w-4" />
          </Toggle>

          {/* Quote & Code */}
          <Toggle size="sm" aria-label="Quote" onPressedChange={() => execCommand('formatBlock', '<blockquote>')}>
            <Quote className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Code" onPressedChange={() => execCommand('formatBlock', '<pre>')}>
            <Code className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Link */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Link className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-background border border-border z-50">
              <Label className="text-xs mb-2 block">Insert Link</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" className="h-8" onClick={insertLink}>
                  Add
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Toggle size="sm" aria-label="Unlink" onPressedChange={() => execCommand('unlink')}>
            <Unlink className="h-4 w-4" />
          </Toggle>

          {/* Image (Media Library / Upload) */}
          {enableImageInsert && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setMediaPickerOpen(true)}
              aria-label="Insert image"
              title="Insert image"
            >
              <Image className="h-4 w-4" />
            </Button>
          )}

          {/* Table */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Table className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3 bg-background border border-border z-50">
              <Label className="text-xs mb-2 block">Insert Table</Label>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Label className="text-xs">Rows</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={tableRows}
                    onChange={(e) => setTableRows(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Cols</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={tableCols}
                    onChange={(e) => setTableCols(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Button size="sm" className="w-full h-8" onClick={insertTable}>
                Insert
              </Button>
            </PopoverContent>
          </Popover>

          {/* Horizontal Rule */}
          <Toggle size="sm" aria-label="Horizontal Line" onPressedChange={insertHorizontalRule}>
            <Minus className="h-4 w-4" />
          </Toggle>

          {/* Remove Formatting */}
          <Toggle size="sm" aria-label="Remove Formatting" onPressedChange={() => execCommand('removeFormat')}>
            <RemoveFormatting className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Fullscreen */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsFullscreen((v) => !v)}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {enableImageInsert && (
          <WebsiteMediaPickerDialog
            open={mediaPickerOpen}
            onOpenChange={setMediaPickerOpen}
            title="Insert image"
            accept="image/*"
            onPick={(pick) => {
              insertImageAtCursor(pick.url, pick.name);
              setMediaPickerOpen(false);
            }}
          />
        )}

        {/* Editor Area */}
        <div
          ref={editorRef}
          contentEditable={isEditing}
          onInput={handleInput}
          onFocus={() => {
            refreshSelectionState();
          }}
          onBlur={() => {
            // do not clear selection state; toolbar actions need last-known selection
          }}
          onKeyUp={() => refreshSelectionState()}
          onMouseUp={() => refreshSelectionState()}
          dir="ltr"
          className={`rte-content p-4 focus:outline-none max-w-none ${isFullscreen ? 'flex-1 min-h-0 overflow-y-auto' : 'min-h-[400px] max-h-[60vh] overflow-y-auto'} ${!isEditing ? 'bg-muted/10 cursor-not-allowed' : 'bg-background'}`}
          style={{
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            direction: 'ltr',
            textAlign: 'left',
            unicodeBidi: 'plaintext',
          }}
        />
      </div>
    </div>
  );
}

