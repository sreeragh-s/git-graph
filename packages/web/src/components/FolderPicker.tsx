interface FolderPickerProps {
  onAnalyze: (path: string) => void;
  loading: boolean;
}

export default function FolderPicker({ onAnalyze, loading }: FolderPickerProps) {
  let inputRef: HTMLInputElement | null = null;

  function handleClick() {
    inputRef?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Get the first directory's path
    // Note: browsers only give us the directory name, not the full path for security
    // We ask the user to enter the full path manually
    const item = files[0];
    const path = (item as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    const dirPath = path.split('/')[0];

    if (dirPath) {
      const fullPath = prompt(
        'Enter the full path to the repository:',
        `/Users/${localStorage.getItem('lastUser') ?? ''}/${dirPath}`
      );
      if (fullPath) {
        onAnalyze(fullPath);
      }
    }
    e.target.value = '';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
      <input
        ref={el => { inputRef = el; }}
        type="file"
        // @ts-expect-error webkitdirectory is not in the standard types
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', background: loading ? 'var(--surface-2)' : 'var(--accent)',
          color: loading ? 'var(--text-muted)' : '#fff',
          border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 500, transition: 'opacity 0.15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        Add Folder
      </button>
    </div>
  );
}
