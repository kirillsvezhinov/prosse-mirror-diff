export class LanguageService {
  private static readonly ALLOWED_LANGUAGES = [
    'typescript',
    'javascript',
    'python',
    'css',
    'java',
    'powershell',
    'cpp',
    'csharp',
    'clike',
    'c',
    'objectivec',
    'rust',
    'sql',
    'swift',
    'json',
    'yml',
    'docker',
    'plaintext',
  ];

  private static readonly CODE_LANGUAGE_FRIENDLY_NAME_MAP: Record<string, string> = {
    c: 'C',
    clike: 'C-like',
    cpp: 'C++',
    css: 'CSS',
    go: 'Go',
    html: 'HTML',
    java: 'Java',
    js: 'JavaScript',
    markdown: 'Markdown',
    objc: 'Objective-C',
    plain: 'Plain Text',
    powershell: 'PowerShell',
    py: 'Python',
    rust: 'Rust',
    sql: 'SQL',
    swift: 'Swift',
    typescript: 'TypeScript',
    xml: 'XML',
    plaintext: 'Plain text',
  };

  private static readonly CODE_LANGUAGE_MAP: Record<string, string> = {
    cpp: 'cpp',
    golang: 'go',
    java: 'java',
    javascript: 'js',
    md: 'markdown',
    plaintext: 'plaintext',
    python: 'py',
    text: 'plain',
    ts: 'typescript',
  };

  static DEFAULT_LANGUAGE = 'javascript';

  static getAllowedLanguages(): Array<string> {
    return this.ALLOWED_LANGUAGES;
  }

  static getLanguageFriendlyName(lang: string): string {
    const normalizedLang = this.normalizeCodeLanguage(lang);

    return this.CODE_LANGUAGE_FRIENDLY_NAME_MAP[normalizedLang] || normalizedLang;
  }

  static normalizeCodeLanguage(lang: string): string {
    return this.CODE_LANGUAGE_MAP[lang] || lang;
  }
}
