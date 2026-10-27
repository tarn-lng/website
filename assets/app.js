/**
 * Tarn Programming Language — Official Website Application
 */

const repoRoot = 'https://github.com/tarn-lng/tarn/blob/main/';
// assets/release.js holds the last known release; loadLatestRelease() replaces
// it with the newest published one when the GitHub API is reachable.
let tarnVersion, releaseTag, releaseDownload, platformLabel;
const archLabels = { x86_64: 'x86_64', aarch64: 'ARM64 (aarch64)' };
function useRelease(release) {
  tarnRelease = release;
  tarnVersion = release.version;
  releaseTag = `https://github.com/tarn-lng/tarn/releases/tag/v${tarnVersion}`;
  releaseDownload = `https://github.com/tarn-lng/tarn/releases/download/v${tarnVersion}/`;
  platformLabel = release.archives.map(arch => arch === 'aarch64' ? 'ARM64' : arch).join(' &amp; ');
}
useRelease(tarnRelease);

// Tarn releases are prereleases, which /releases/latest skips; the list is newest first.
async function loadLatestRelease() {
  try {
    const res = await fetch('https://api.github.com/repos/tarn-lng/tarn/releases?per_page=10', { headers: { accept: 'application/vnd.github+json' } });
    if (!res.ok) return false;
    for (const r of await res.json()) {
      const match = /^v(\d+\.\d+\.\d+)$/.exec(r.tag_name);
      if (r.draft || !match) continue;
      const version = match[1];
      const names = new Set(r.assets.map(a => a.name));
      const archives = ['x86_64', 'aarch64'].filter(arch => names.has(`tarn-${version}-linux-${arch}.tar.gz`));
      // Skip a release whose assets are still uploading.
      if (archives.length === 0 || !names.has('SHA256SUMS')) continue;
      if (version === tarnVersion && archives.join() === tarnRelease.archives.join()) return false;
      useRelease({ version, archives });
      return true;
    }
  } catch (_) { /* offline or rate-limited: keep the bundled release */ }
  return false;
}

const registryBase = 'https://tarn-lng.github.io/registry/';

// DOM Helpers
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

/**
 * Lightweight Tarn Syntax Highlighter
 */
function highlightTarn(code) {
  const tokenSpec = [
    { type: 'comment', regex: /\/\/[^\n]*/ },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"/ },
    { type: 'keyword', regex: /\b(?:async|fn|struct|enum|interface|impl|copy|var|mut|pub|import|unsafe|extern|return|if|else|for|in|break|continue|match|try|await|spawn|move|true|false|self|any)\b/ },
    { type: 'type', regex: /\b(?:bool|i8|i16|i32|i64|u8|u16|u32|u64|isize|usize|f32|f64|string|void|never|Option|Result|Some|None|Ok|Err)\b/ },
    { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ },
    { type: 'call', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
    { type: 'other', regex: /[^\s\w]+|\w+|\s+/ }
  ];

  const masterRegex = new RegExp(
    tokenSpec.map((s, i) => `(?<t${i}>${s.regex.source})`).join('|'),
    'g'
  );

  let result = '';
  let match;
  while ((match = masterRegex.exec(code)) !== null) {
    let tokenType = 'other';
    for (let i = 0; i < tokenSpec.length; i++) {
      if (match.groups[`t${i}`] !== undefined) {
        tokenType = tokenSpec[i].type;
        break;
      }
    }
    const val = escapeHtml(match[0]);
    if (tokenType !== 'other') {
      result += `<span class="tok-${tokenType}">${val}</span>`;
    } else {
      result += val;
    }
  }
  return result;
}

/**
 * Code Block Builder with Copy Button
 */
function codeBlock(code, lang = 'tarn', filename = '') {
  const highlighted = lang === 'tarn' ? highlightTarn(code.trim()) : escapeHtml(code.trim());
  const headerHtml = `
    <div class="code-header">
      <span>${filename ? escapeHtml(filename) : `<span class="lang-tag">${lang.toUpperCase()}</span>`}</span>
      <button class="btn-copy" type="button" aria-label="Copy code">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copy
      </button>
    </div>
  `;
  return `
    <div class="code-box">
      ${headerHtml}
      <pre class="code-content"><code>${highlighted}</code></pre>
    </div>
  `;
}

/**
 * Interactive Showcase Tabs Data
 */
const showcaseTabs = [
  {
    id: 'ownership',
    label: 'Ownership & Moves',
    code: `struct Buffer {
    data string
}

fn Buffer.new() Buffer {
    return Buffer{data: "hello"}
}

fn consume(b Buffer) {
    print(b.data)
}

fn main() {
    a := Buffer.new()
    b := a              // 'a' is moved into 'b'
    consume(b)          // 'b' is moved into 'consume'

    // print(a.data)    // Compile error: use of moved value 'a'
}`,
    title: 'Zero-Cost Memory Safety',
    desc: 'Tarn manages heap resources deterministically at compile time without a garbage collector. Non-Copy types are moved on assignment and call, preventing double-frees and dangling references before code ever runs.',
    bullets: [
      'Values move by default unless declared Copy',
      'No implicit cloning or background heap duplication',
      'Fine-grained move tracking per struct field'
    ],
    verified: 'Verified with tarn check'
  },
  {
    id: 'borrowing',
    label: 'Inferred Lifetimes',
    code: `struct Counter {
    value i64
}

fn bump(c &mut Counter) {
    c.value = c.value + 1
}

fn inspect(c &Counter) i64 {
    return c.value
}

fn main() {
    var c = Counter{value: 0}
    bump(&mut c)

    // Shared borrow borrows 'c' while active
    r := inspect(&c)
    print(r)
}`,
    title: 'Borrowing Without Lifetime Annotations',
    desc: 'Shared borrows (&T) permit read access; mutable borrows (&mut T) ensure exclusive mutation. The compiler infers reference provenance across function bodies—no lifetime parameters in source code.',
    bullets: [
      'Shared (&) and exclusive mutable (&mut) loans',
      'Lifetimes inferred by compiler provenance analysis',
      'Automatic reborrowing for nested mutable references'
    ],
    verified: 'Verified with tarn check'
  },
  {
    id: 'structs',
    label: 'Structs & Methods',
    code: `struct Point {
    x f64
    y f64
}

fn Point.new(x f64, y f64) Point {
    return Point{x: x, y: y}
}

fn Point.translate(&mut self, dx f64, dy f64) {
    self.x = self.x + dx
    self.y = self.y + dy
}

fn Point.dist(&self) f64 {
    return (self.x * self.x + self.y * self.y)
}

fn main() {
    var pt = Point.new(3.0, 4.0)
    pt.translate(1.0, 1.0)
    print(pt.dist())
}`,
    title: 'Direct Inherent Methods',
    desc: 'Methods in Tarn are declared directly on their type: fn Type.method(&self). There are no separate inherent impl blocks, keeping method definitions visually identical to their call sites.',
    bullets: [
      'Clean declaration: fn Type.method(&self)',
      'Constructors are standard functions: fn Type.new()',
      'Explicit &self, &mut self, or consuming self receiver'
    ],
    verified: 'Verified with tarn check'
  },
  {
    id: 'interfaces',
    label: 'Interfaces & Generics',
    code: `interface Shape {
    fn area(&self) f64
}

struct Square {
    side f64
}

impl Shape for Square {
    fn area(&self) f64 {
        return self.side * self.side
    }
}

// Static dispatch via generic bound:
fn print_static<S: Shape>(s &S) {
    print(s.area())
}

// Dynamic dispatch via interface reference:
fn print_dynamic(s &any Shape) {
    print(s.area())
}

fn main() {
    sq := Square{side: 4.0}
    print_static(&sq)
    print_dynamic(&sq)
}`,
    title: 'Nominal Interfaces & Bounds',
    desc: 'Interfaces define contracts with nominal implementation (impl Interface for Type). Tarn supports both monomorphized static dispatch (<T: Bound>) and explicit dynamic dispatch (&any Interface).',
    bullets: [
      'Nominal implementation ensures coherence',
      'Static dispatch with generic bounds (<T: Bound>)',
      'Dynamic dispatch using &any Interface'
    ],
    verified: 'Verified with tarn check'
  },
  {
    id: 'errors',
    label: 'Prefix try & Results',
    code: `import "fs"
import "io"

struct Config {
    port u16
}

fn load_port(path &string) Result<u16, io.Error> {
    // Prefix 'try' bubbles errors immediately
    text := try fs.read_text(path)
    return Ok(8080)
}

fn main() {
    match load_port(&"config.txt") {
        Ok(port) => print(port)
        Err(e)   => print("Failed to load config")
    }
}`,
    title: 'Actionable Error Handling',
    desc: 'Recoverable errors use Result<T, E> and Option<T>. The prefix try operator unwraps success or returns the error early without hidden conversions or exception overhead.',
    bullets: [
      'Result<T, E> and Option<T> in the prelude',
      'Prefix try replaces cumbersome boilerplate',
      'Exhaustive match ensures all cases are handled'
    ],
    verified: 'Verified with tarn check'
  },
  {
    id: 'concurrency',
    label: 'Native Concurrency',
    code: `import "io"

fn compute(id i32) i32 {
    return id * 2
}

fn main() Result<void, io.Error> {
    // Spawn a native OS task with move semantics
    task := spawn move fn() i32 {
        return compute(21)
    }

    // Join task explicitly to receive the result
    answer := try task.join()
    print(answer)
    return Ok(())
}`,
    title: 'Safe Native Concurrency',
    desc: 'Tarn supports handle-owned native tasks via spawn move fn(). Captured values must satisfy Transfer semantics. Task handles guarantee completion on drop or explicit join.',
    bullets: [
      'Native OS threads with handle-based lifecycle',
      'Type capabilities (Transfer and Share) enforce safety',
      'No data races on shared memory'
    ],
    verified: 'Verified with tarn check'
  }
];

/**
 * Page Definitions
 */
const pages = {
  home: () => `
    <section class="hero-section">
      <div class="version-badge" style="display:inline-block; margin-bottom:16px;">Linux ${platformLabel} · Release v${tarnVersion}</div>
      <h1 class="hero-title">The <span class="accent-text">Tarn</span> Programming Language</h1>
      <p class="hero-lead">
        A statically typed systems language with compile-time ownership, inferred lifetimes, native machine code generation, and zero mandatory garbage collection. Built for human systems engineers and coding agents.
      </p>

      <div class="hero-actions">
        <a class="btn btn-primary" href="#install">Install Tarn v${tarnVersion} →</a>
        <a class="btn btn-secondary" href="#tour">Language Tour & Syntax</a>
        <a class="btn btn-ghost" href="#stdlib">Standard Library</a>
        <a class="btn btn-ghost" href="https://github.com/tarn-lng/tarn" target="_blank" rel="noopener">GitHub ↗</a>
      </div>

      <div class="hero-install-box">
        <div class="terminal-card">
          <div class="terminal-header">
            <span>QUICK INSTALL (LINUX ${platformLabel})</span>
            <button class="btn-copy" type="button" aria-label="Copy install command">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </button>
          </div>
          <pre class="terminal-body"><code><span class="prompt">$</span>curl --fail --proto '=https' https://tarn-lng.github.io/website/install.sh -o install.sh
<span class="prompt">$</span>sh install.sh</code></pre>
          <div class="terminal-footer">
            <span>Installs <code>tarn</code> and <code>tarn-lsp</code> to <code>~/.local/bin</code> (no sudo)</span>
            <a class="text-link" href="#install">Details & verification →</a>
          </div>
        </div>
      </div>
    </section>

    <!-- Code Showcase Section with Tabs -->
    <section class="showcase-section">
      <div class="section-heading">
        <h2>Language at a Glance</h2>
        <p>Explore genuine Tarn syntax verified directly against the v${tarnVersion} compiler.</p>
      </div>

      <div class="tabs-container">
        <div class="tab-nav" role="tablist">
          ${showcaseTabs.map((t, idx) => `
            <button class="tab-btn ${idx === 0 ? 'active' : ''}" type="button" role="tab" data-tab="${t.id}">${t.label}</button>
          `).join('')}
        </div>
        <div class="tab-content" id="tab-content-panel">
          <!-- Populated by JS -->
        </div>
      </div>
    </section>

    <!-- Core Technical Highlights -->
    <section class="pillars-section">
      <div class="section-heading">
        <h2>Technical Architecture</h2>
        <p>Sound static guarantees without unnecessary syntactic overhead.</p>
      </div>

      <div class="grid-3">
        <div class="pillar-card">
          <span class="pillar-icon">01 / OWNERSHIP</span>
          <h3>Zero-Cost Compile-Time Safety</h3>
          <p>Memory safety is enforced entirely at compile time through move analysis and fine-grained NLL borrow checking. Values destruct deterministically with no garbage collection pauses.</p>
        </div>

        <div class="pillar-card">
          <span class="pillar-icon">02 / PROVENANCE</span>
          <h3>Inferred Lifetimes</h3>
          <p>Tarn infers loan origins and reference provenance across function boundaries automatically. Application code remains free of explicit lifetime syntax (no <code>'a</code> annotations).</p>
        </div>

        <div class="pillar-card">
          <span class="pillar-icon">03 / PERFORMANCE</span>
          <h3>Native Linux x86_64 &amp; ARM64</h3>
          <p>Compiles directly to native ELF machine code using Cranelift. Executables are standalone and interface smoothly with standard C dynamic libraries via explicit <code>--link</code>.</p>
        </div>

        <div class="pillar-card">
          <span class="pillar-icon">04 / SYNTAX</span>
          <h3>Regular & Predictable Grammar</h3>
          <p>No semicolons, explicit <code>return</code>, prefix <code>try</code>, nominal interfaces, and distinct <code>fn Type.method(&self)</code> definitions. Unambiguous grammar optimized for developers and coding agents.</p>
        </div>

        <div class="pillar-card">
          <span class="pillar-icon">05 / TOOLCHAIN</span>
          <h3>Integrated Toolchain & LSP</h3>
          <p>The single <code>tarn</code> CLI handles building, formatting, testing, and dependency resolution. Machine-readable <code>tarn check --json</code> powers editor tooling and agent verification.</p>
        </div>

        <div class="pillar-card">
          <span class="pillar-icon">06 / STDLIB</span>
          <h3>Bundled Standard Library</h3>
          <p>Comprehensive standard library embedded in the compiler: native I/O, TCP/UDP sockets, HTTP/HTTPS client and server, JSON, CSV, collections, and process management.</p>
        </div>
      </div>
    </section>

    <!-- Quickstart 3-Steps -->
    <section class="quickstart-section">
      <div class="section-heading">
        <h2>Start Building in Minutes</h2>
        <p>From zero to running your first native Tarn binary.</p>
      </div>

      <div class="steps-grid">
        <div class="step-card">
          <span class="step-badge">STEP 1</span>
          <h3>Install Toolchain</h3>
          <p>Download the prebuilt compiler and language server using the verified installer:</p>
          ${codeBlock(`sh install.sh\nexport PATH="$HOME/.local/bin:$PATH"`, 'bash')}
        </div>

        <div class="step-card">
          <span class="step-badge">STEP 2</span>
          <h3>Create a Project</h3>
          <p>Initialize a new workspace with default manifest and entry point:</p>
          ${codeBlock('tarn init hello\ncd hello\ncat main.tarn', 'bash')}
        </div>

        <div class="step-card">
          <span class="step-badge">STEP 3</span>
          <h3>Compile and Run</h3>
          <p>Execute your program with a single command or emit an optimized native binary:</p>
          ${codeBlock('tarn run\ntarn build -o hello-bin', 'bash')}
        </div>
      </div>
    </section>
  `,

  tour: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">Language Tour</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="#tour-vars">Variables & Declarations</a>
          <a class="sidebar-link" href="#tour-types">Primitive Types & Arrays</a>
          <a class="sidebar-link" href="#tour-functions">Functions & Calls</a>
          <a class="sidebar-link" href="#tour-control">Control Flow</a>
          <a class="sidebar-link" href="#tour-structs">Structs & Methods</a>
          <a class="sidebar-link" href="#tour-enums">Enums & Pattern Matching</a>
          <a class="sidebar-link" href="#tour-interfaces">Interfaces & Dispatch</a>
          <a class="sidebar-link" href="#tour-generics">Generics & Bounds</a>
          <a class="sidebar-link" href="#tour-ownership">Ownership & Moves</a>
          <a class="sidebar-link" href="#tour-borrowing">Borrowing & Lifetimes</a>
          <a class="sidebar-link" href="#tour-errors">Error Handling & try</a>
          <a class="sidebar-link" href="#tour-concurrency">Native Concurrency</a>
          <a class="sidebar-link" href="#tour-async">Async Execution</a>
          <a class="sidebar-link" href="#tour-modules">Modules & Imports</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Tarn Language Tour</h1>
        <p class="doc-lead">A comprehensive guide to Tarn syntax, type rules, and semantic guarantees.</p>

        <!-- Variables -->
        <section class="doc-section" id="tour-vars">
          <h2>Variables & Declarations</h2>
          <p>Tarn distinguishes immutable bindings (<code>:=</code>) from mutable variables (<code>var</code>). Explicit type annotations use <code>: Type</code>.</p>
          ${codeBlock(`fn main() {
    // Immutable binding (inferred type)
    count := 10

    // Immutable binding with explicit type
    limit: u64 := 100

    // Mutable binding
    var total: i64 = 0
    total = total + count

    print(total)
}`)}
          <div class="callout">
            <strong>Statement boundaries:</strong> Tarn has no semicolons. Statements are separated by line breaks. Compound assignment operators like <code>+=</code> do not exist in v0; write <code>x = x + 1</code>.
          </div>
        </section>

        <!-- Primitive Types -->
        <section class="doc-section" id="tour-types">
          <h2>Primitive Types & Arrays</h2>
          <p>Tarn provides fixed-width scalar integers, floating point numbers, UTF-8 strings, fixed arrays, and borrowed slices.</p>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Type Category</th><th>Types</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>Signed Integers</td><td><code>i8, i16, i32, i64, isize</code></td><td>Two's complement signed integers</td></tr>
                <tr><td>Unsigned Integers</td><td><code>u8, u16, u32, u64, usize</code></td><td>Unsigned integers and pointer-sized integers</td></tr>
                <tr><td>Floats</td><td><code>f32, f64</code></td><td>IEEE 754 floating point numbers</td></tr>
                <tr><td>Booleans</td><td><code>bool</code></td><td><code>true</code> or <code>false</code></td></tr>
                <tr><td>Text</td><td><code>string</code></td><td>Immutable UTF-8 byte sequence</td></tr>
                <tr><td>Fixed Arrays</td><td><code>[N]T</code></td><td>Inline fixed-size buffer, e.g. <code>[4]i32{1, 2, 3, 4}</code></td></tr>
                <tr><td>Slices</td><td><code>[]T</code></td><td>Dynamically sized view borrowed as <code>&[]T</code></td></tr>
              </tbody>
            </table>
          </div>
          ${codeBlock(`fn sum(values &[]i64) i64 {
    var total = 0
    for v in values {
        total = total + v
    }
    return total
}

fn main() {
    numbers := [4]i64{1, 2, 3, 4}
    print(sum(&numbers))          // Array borrows as slice
    print(sum(&numbers[1..3]))    // Sub-slice
}`)}
        </section>

        <!-- Functions -->
        <section class="doc-section" id="tour-functions">
          <h2>Functions & Calls</h2>
          <p>In function parameter lists, the type follows the name directly (no colon). Return statements are always explicit.</p>
          ${codeBlock(`fn add(a i32, b i32) i32 {
    return a + b
}

fn greet(name &string) {
    print(name)
}`)}
          <div class="callout">
            Tarn is not an expression-oriented language: blocks, <code>if</code>, and <code>match</code> statements do not produce return values. <code>return</code> must be written explicitly.
          </div>
        </section>

        <!-- Control Flow -->
        <section class="doc-section" id="tour-control">
          <h2>Control Flow</h2>
          <p>Control flow is expressed with <code>if / else</code> and <code>for</code>. Loops support range iteration, while-conditions, and infinite loops with <code>break</code> and <code>continue</code>.</p>
          ${codeBlock(`fn main() {
    // Range loop
    var total = 0
    for i in 0..5 {
        total = total + i
    }

    // Condition loop
    var n = 10
    for n > 0 {
        n = n - 1
    }

    // Infinite loop with break
    for {
        break
    }
}`)}
        </section>

        <!-- Structs & Inherent Methods -->
        <section class="doc-section" id="tour-structs">
          <h2>Structs & Inherent Methods</h2>
          <p>Structs define composite types. Methods are declared using the exact syntax used at call sites: <code>fn Type.method(...)</code>.</p>
          ${codeBlock(`struct User {
    name string
    age  u32
}

fn User.new(name string) User {
    return User{name: name, age: 0}
}

fn User.birthday(&mut self) {
    self.age = self.age + 1
}

fn User.greet(&self) {
    print(self.name)
}

fn main() {
    var user = User.new("Ada")
    user.birthday()
    user.greet()
}`)}
        </section>

        <!-- Enums & Match -->
        <section class="doc-section" id="tour-enums">
          <h2>Enums & Pattern Matching</h2>
          <p>Enums represent sum types with optional data payloads. Pattern matching uses usefulness analysis to guarantee exhaustiveness.</p>
          ${codeBlock(`copy enum Shape {
    Circle(f64)
    Rect(f64, f64)
    Empty
}

fn area(s &Shape) f64 {
    match s {
        Circle(r) => return 3.14159 * r * r
        Rect(w, h) => return w * h
        Empty => return 0.0
    }
}`)}
        </section>

        <!-- Interfaces & Dispatch -->
        <section class="doc-section" id="tour-interfaces">
          <h2>Interfaces & Dispatch</h2>
          <p>Interfaces use nominal implementation. Tarn supports monomorphized static dispatch and dynamic dispatch via <code>any Interface</code>.</p>
          ${codeBlock(`interface Shape {
    fn area(&self) f64
}

struct Square {
    side f64
}

impl Shape for Square {
    fn area(&self) f64 {
        return self.side * self.side
    }
}

// Static dispatch (zero runtime overhead)
fn print_area<S: Shape>(s &S) {
    print(s.area())
}

// Dynamic dispatch (vtable reference)
fn print_any(s &any Shape) {
    print(s.area())
}`)}
        </section>

        <!-- Generics & Bounds -->
        <section class="doc-section" id="tour-generics">
          <h2>Generics & Bounds</h2>
          <p>Structs, enums, functions, and methods can be generic over type parameters, with optional interface bounds.</p>
          ${codeBlock(`struct Pair<A, B> {
    first  A
    second B
}

fn Pair<A, B>.swap(self) Pair<B, A> {
    return Pair{first: self.second, second: self.first}
}

fn print_value<T: Copy>(val T) {
    print(val)
}`)}
        </section>

        <!-- Ownership & Moves -->
        <section class="doc-section" id="tour-ownership">
          <h2>Ownership & Moves</h2>
          <p>Values in Tarn have a single owner. Passing an owned non-Copy value transfers ownership, making the original variable unusable.</p>
          ${codeBlock(`struct Buffer {
    data string
}

fn consume(b Buffer) {
    print(b.data)
}

fn main() {
    a := Buffer{data: "tarn"}
    b := a              // 'a' moved to 'b'
    consume(b)          // 'b' moved to 'consume'
    // print(a.data)    // error[E4001]: use of moved value 'a'
}`)}
        </section>

        <!-- Borrowing & Inferred Lifetimes -->
        <section class="doc-section" id="tour-borrowing">
          <h2>Borrowing & Inferred Lifetimes</h2>
          <p>Borrowing permits inspection without transferring ownership. Tarn enforces the aliasing rule: any number of shared borrows <code>&T</code>, OR exactly one mutable borrow <code>&mut T</code>.</p>
          ${codeBlock(`struct Counter {
    value i64
}

fn bump(c &mut Counter) {
    c.value = c.value + 1
}

fn main() {
    var c = Counter{value: 0}
    bump(&mut c)

    r := &c
    // bump(&mut c)     // error[E4101]: 'c' is mutably borrowed while 'r' is alive
    print(r.value)
}`)}
          <div class="callout">
            <strong>No explicit lifetimes in v0:</strong> Tarn does not use Rust-style <code>'a</code> lifetime parameters. The compiler infers loan origins and provenance directly from control flow.
          </div>
        </section>

        <!-- Error Handling -->
        <section class="doc-section" id="tour-errors">
          <h2>Error Handling & Prefix try</h2>
          <p>Recoverable errors return <code>Result<T, E></code> or <code>Option<T></code>. The prefix <code>try</code> operator propagates errors to the caller.</p>
          ${codeBlock(`import "fs"
import "io"

fn read_config(path &string) Result<string, io.Error> {
    content := try fs.read_text(path)
    return Ok(content)
}

fn main() {
    match read_config(&"app.conf") {
        Ok(text) => print(text)
        Err(err) => print("Could not load config")
    }
}`)}
        </section>

        <!-- Concurrency -->
        <section class="doc-section" id="tour-concurrency">
          <h2>Native Tasks & Concurrency</h2>
          <p>Phase 11 native tasks are spawned using <code>spawn move fn()</code> and managed through owned handles.</p>
          ${codeBlock(`fn worker(id i32) i32 {
    return id * 10
}

fn main() {
    task := spawn move fn() i32 {
        return worker(4)
    }
    result := task.join()
    print(result)
}`)}
        </section>

        <!-- Async -->
        <section class="doc-section" id="tour-async">
          <h2>Async Execution</h2>
          <p>Cooperative asynchronous execution uses <code>async fn</code> and <code>await</code> over a non-blocking single-thread runtime.</p>
          ${codeBlock(`import "net"
import "io"

async fn echo(stream &mut net.TcpStream) Result<usize, io.Error> {
    var bytes = [16]u8{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
    count := try await stream.read_async(&mut bytes)
    try await stream.write_all_async(&bytes[0..count])
    return Ok(count)
}`)}
        </section>

        <!-- Modules -->
        <section class="doc-section" id="tour-modules">
          <h2>Modules & Imports</h2>
          <p>Standard library modules and packages are imported using string literals: <code>import "name"</code>. Public declarations are annotated with <code>pub</code>.</p>
          ${codeBlock(`import "net"
import "fs"
import "collections"

pub fn process() {
    // ...
}`)}
        </section>
      </main>
    </div>
  `,

  stdlib: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">Standard Library</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="#std-core">core</a>
          <a class="sidebar-link" href="#std-io">io</a>
          <a class="sidebar-link" href="#std-fs">fs</a>
          <a class="sidebar-link" href="#std-net">net</a>
          <a class="sidebar-link" href="#std-http">http & https</a>
          <a class="sidebar-link" href="#std-json">json</a>
          <a class="sidebar-link" href="#std-csv">csv</a>
          <a class="sidebar-link" href="#std-collections">collections</a>
          <a class="sidebar-link" href="#std-string">string</a>
          <a class="sidebar-link" href="#std-time">time</a>
          <a class="sidebar-link" href="#std-os">os & process</a>
          <a class="sidebar-link" href="#std-console">console</a>
          <a class="sidebar-link" href="#std-runtime">runtime</a>
          <a class="sidebar-link" href="#std-ffi">ffi</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Standard Library Reference</h1>
        <p class="doc-lead">All 17 standard modules are built into the compiler binary and can be inspected locally via <code>tarn stdlib [module] --json</code>.</p>

        <!-- core -->
        <section class="doc-section" id="std-core">
          <h2>core</h2>
          <p>Fundamental capabilities, capabilities interfaces (<code>Hash</code>, <code>Eq</code>, <code>Copy</code>), <code>Option<T></code>, <code>Result<T, E></code>, and abort routines.</p>
          ${codeBlock(`// Built-in Option and Result are part of core and in the prelude:
val: Option<i32> = Some(42)
res: Result<string, io.Error> = Ok("success")`)}
        </section>

        <!-- io -->
        <section class="doc-section" id="std-io">
          <h2>io</h2>
          <p>Universal I/O primitives: <code>Reader</code>, <code>Writer</code>, <code>Stream</code>, <code>Error</code>, and <code>ErrorKind</code>.</p>
          ${codeBlock(`import "io"

fn write_data<W: io.Writer>(w &mut W, data &[]u8) Result<usize, io.Error> {
    return w.write(data)
}`)}
        </section>

        <!-- fs -->
        <section class="doc-section" id="std-fs">
          <h2>fs</h2>
          <p>Owned file descriptors, text reading/writing, and file system traversal.</p>
          ${codeBlock(`import "fs"

// Read entire file as UTF-8 string:
content := try fs.read_text("data.txt")

// Write entire string to file:
try fs.write_text("output.txt", &content)`)}
        </section>

        <!-- net -->
        <section class="doc-section" id="std-net">
          <h2>net</h2>
          <p>Blocking and asynchronous TCP/UDP networking: <code>TcpListener</code>, <code>TcpStream</code>, <code>UdpSocket</code>, address parsing.</p>
          ${codeBlock(`import "net"

var listener = try net.listen_tcp(&"127.0.0.1:8080")
conn := try listener.accept()
try conn.write_all(&[2]u8{104, 105})`)}
        </section>

        <!-- http & https -->
        <section class="doc-section" id="std-http">
          <h2>http & https</h2>
          <p>HTTP/1.1 request/response parser, connection multiplexer, server dispatcher, and bounded TLS HTTPS client.</p>
          ${codeBlock(`import "http"

fn handle(req http.Request) Result<http.Response, http.Error> {
    if req.target() == &"/health" {
        return http.Response.text(u16(200), &"ok\\n")
    }
    return http.Response.bytes(u16(404), Vec.new())
}`)}
        </section>

        <!-- json -->
        <section class="doc-section" id="std-json">
          <h2>json</h2>
          <p>Strict RFC 8259 parser and streaming encoder. No reflection: types implement <code>json.Encode</code>.</p>
          ${codeBlock(`import "json"

val := try json.parse(&"{\\"id\\": 42, \\"name\\": \\"tarn\\"}")
print(val.is_object())`)}
        </section>

        <!-- csv -->
        <section class="doc-section" id="std-csv">
          <h2>csv</h2>
          <p>RFC 4180 streaming reader and parser with field escaping and row iteration.</p>
        </section>

        <!-- collections -->
        <section class="doc-section" id="std-collections">
          <h2>collections</h2>
          <p>Hash map (<code>Map<K, V></code>) with open addressing and linear probing, dynamic vectors, and sets.</p>
          ${codeBlock(`import "collections"

var m = collections.Map<string, i32>.new()
m.insert("port", 8080)
if m.contains(&"port") {
    print(*m.get(&"port"))
}`)}
        </section>

        <!-- string -->
        <section class="doc-section" id="std-string">
          <h2>string</h2>
          <p>UTF-8 substring extraction, trimming, integer parsing, and line splitting.</p>
          ${codeBlock(`import "string"

num := string.parse_i64(&"12345") // Option<i64>
lines := string.lines(&"a\\nb\\nc")`)}
        </section>

        <!-- time -->
        <section class="doc-section" id="std-time">
          <h2>time</h2>
          <p>Monotonic clock measurement, <code>Instant</code>, <code>Duration</code>, and sleep routines.</p>
          ${codeBlock(`import "time"

start := time.Instant.now()
time.sleep(time.Duration.from_millis(50))
elapsed := start.elapsed()`)}
        </section>

        <!-- os & process -->
        <section class="doc-section" id="std-os">
          <h2>os & process</h2>
          <p>Command line arguments, environment inspection, process exit, and owned child execution.</p>
          ${codeBlock(`import "os"
import "process"

args := os.args()
child := try process.spawn_command(&"ls", &["-la"])
status := try child.wait()`)}
        </section>

        <!-- console -->
        <section class="doc-section" id="std-console">
          <h2>console</h2>
          <p>Standard streams: <code>stdin()</code>, <code>stdout()</code>, <code>stderr()</code>, and buffered flush management.</p>
        </section>

        <!-- runtime -->
        <section class="doc-section" id="std-runtime">
          <h2>runtime</h2>
          <p>Cooperative task executor, event loop wakers, and readiness tokens.</p>
        </section>

        <!-- ffi -->
        <section class="doc-section" id="std-ffi">
          <h2>ffi</h2>
          <p>C ABI interoperability: <code>unsafe</code> function calls, pointers, and raw buffer views.</p>
        </section>
      </main>
    </div>
  `,

  packages: () => `
    <section class="hero-section" style="padding-bottom: 24px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 style="margin:0 0 10px;">Package Registry</h1>
          <p class="hero-lead" style="margin:0;">
            Immutable, source-only packages for Tarn. Verified by cryptographic SHA-256 integrity checks.
          </p>
        </div>
        <a class="btn btn-secondary btn-sm" href="#publish" style="margin-top:6px;">+ Propose a Library</a>
      </div>

      <div class="search-input-box">
        <input class="search-input" id="pkg-search" type="search" placeholder="Search packages by name, description, or native library..." aria-label="Search packages">
      </div>

      <div class="registry-controls">
        <div class="registry-filters" id="pkg-filters">
          <button class="filter-btn active" type="button" data-filter="all">All Packages</button>
          <button class="filter-btn" type="button" data-filter="native">Native C / FFI</button>
          <button class="filter-btn" type="button" data-filter="pure">Pure Tarn</button>
        </div>
        <div class="registry-sort">
          <label for="pkg-sort-select">Sort by:</label>
          <select id="pkg-sort-select">
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="recent">Recently Published</option>
          </select>
        </div>
      </div>

      <div id="pkg-status" style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">Loading packages…</div>
      <div class="package-list" id="pkg-list"></div>
      <div id="pkg-pagination"></div>
    </section>
  `,

  publish: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">Registry</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link" href="#packages">Browse Packages</a>
          <a class="sidebar-link active" href="#publish">Publish a Library</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Publishing to the Registry</h1>
        <p class="doc-lead">Tarn packages are immutable source distributions verified by the compiler and maintainers.</p>

        <section class="doc-section">
          <h2>1. Initialize a Library Workspace</h2>
          <p>Create a package with <code>--lib</code> to generate a library manifest and source file:</p>
          ${codeBlock('tarn init mylib --lib\ncd mylib', 'bash')}
        </section>

        <section class="doc-section">
          <h2>2. Configure tarn.toml</h2>
          <p>Define your package metadata and dependencies:</p>
          ${codeBlock(`[package]
name = "mylib"
version = "0.1.0"
entry = "src/lib.tarn"
description = "A fast utility library for Tarn"
repository = "https://github.com/myname/mylib"`)}
        </section>

        <section class="doc-section">
          <h2>3. Export Release Archive</h2>
          <p>Generate release metadata and SHA-256 checksums locally:</p>
          ${codeBlock('tarn publish --registry /tmp/local-registry', 'bash')}
        </section>

        <section class="doc-section">
          <h2>4. Submit a Pull Request</h2>
          <p>Submit your release record to the official registry repository at <a class="text-link" href="https://github.com/tarn-lng/registry" target="_blank">github.com/tarn-lng/registry</a>. The automated validator verifies that bytes match checksums and all tests pass.</p>
        </section>
      </main>
    </div>
  `,

  tooling: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">Tooling</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="#tooling-cli">CLI Commands</a>
          <a class="sidebar-link" href="#tooling-json">JSON Diagnostics</a>
          <a class="sidebar-link" href="#tooling-lsp">Language Server (LSP)</a>
          <a class="sidebar-link" href="#tooling-vscode">VS Code Extension</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Compiler & Tooling</h1>
        <p class="doc-lead">A unified developer experience: compilation, formatting, testing, and language server built into one binary.</p>

        <section class="doc-section" id="tooling-cli">
          <h2>CLI Commands Reference</h2>
          <p>The <code>tarn</code> command line interface provides a complete suite of subcommands:</p>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Command</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>tarn init [dir] [--lib]</code></td><td>Create a new binary application or library package</td></tr>
                <tr><td><code>tarn check [entry] [--json]</code></td><td>Type-check and borrow-check with human or JSON diagnostics</td></tr>
                <tr><td><code>tarn build [-o out] [--link lib]</code></td><td>Compile to a native Linux x86_64 or ARM64 executable</td></tr>
                <tr><td><code>tarn run [entry] [--link lib]</code></td><td>Compile and execute temporarily</td></tr>
                <tr><td><code>tarn test [--filter text]</code></td><td>Run isolated test functions</td></tr>
                <tr><td><code>tarn fmt [--check]</code></td><td>Format Tarn source code files recursively</td></tr>
                <tr><td><code>tarn stdlib [module] [--json]</code></td><td>Discover embedded public API declarations</td></tr>
                <tr><td><code>tarn add &lt;pkg&gt; [--registry url]</code></td><td>Resolve, download, and lock a dependency in tarn.lock</td></tr>
                <tr><td><code>tarn fetch</code></td><td>Fetch exact locked package sources</td></tr>
                <tr><td><code>tarn deps [--tree]</code></td><td>Print dependency graph visualization</td></tr>
                <tr><td><code>tarn audit [--json]</code></td><td>Audit locked dependencies for known advisories</td></tr>
                <tr><td><code>tarn version</code></td><td>Display current compiler version and target</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="doc-section" id="tooling-json">
          <h2>Machine-Readable Diagnostics (--json)</h2>
          <p>Tarn diagnostics are first-class product features. When run with <code>--json</code>, the compiler outputs structured diagnostics designed for IDEs and LLM coding agents:</p>
          ${codeBlock(`$ tarn check src/main.tarn --json
{
  "code": "E4001",
  "severity": "error",
  "kind": "use_of_moved_value",
  "message": "use of moved value \`buffer\`",
  "file": "src/main.tarn",
  "line": 14,
  "column": 5,
  "help": "consider borrowing with \`&buffer\` if the caller retains ownership"
}`, 'json')}
        </section>

        <section class="doc-section" id="tooling-lsp">
          <h2>Language Server Protocol (tarn-lsp)</h2>
          <p>The companion binary <code>tarn-lsp</code> provides language intelligence to Neovim, Helix, Emacs, and VS Code. It uses the real compiler frontend to guarantee complete accuracy.</p>
        </section>

        <section class="doc-section" id="tooling-vscode">
          <h2>VS Code Extension</h2>
          <p>The official extension lives under <code>editors/vscode</code> in the compiler repository, providing syntax highlighting, hover documentation, and jump-to-definition.</p>
        </section>
      </main>
    </div>
  `,

  install: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">Getting Started</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="#inst-quick">Quick Install</a>
          <a class="sidebar-link" href="#inst-binaries">Prebuilt Binaries</a>
          <a class="sidebar-link" href="#inst-verify">SHA-256 Verification</a>
          <a class="sidebar-link" href="#inst-source">Build from Source</a>
          <a class="sidebar-link" href="#inst-reqs">Requirements</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Install Tarn</h1>
        <p class="doc-lead">The official release v${tarnVersion} provides prebuilt native Linux ${tarnRelease.archives.map(arch => archLabels[arch] || arch).join(' and ')} binaries and a verified installer that picks the right one for your machine.</p>

        <!-- Quick Install -->
        <section class="doc-section" id="inst-quick">
          <h2>Automated Script Install</h2>
          <p>The installer script downloads the archive, verifies SHA-256 checksums, and installs both <code>tarn</code> and <code>tarn-lsp</code> into <code>~/.local/bin</code> (no root required):</p>
          ${codeBlock(`curl --fail --proto '=https' https://tarn-lng.github.io/website/install.sh -o install.sh
sh install.sh                    # newest release
sh install.sh --version ${tarnVersion}    # or pin a specific release

# Add ~/.local/bin to your PATH if not already present:
export PATH="$HOME/.local/bin:$PATH"

# Verify installation:
tarn version`, 'bash')}
          <p style="font-size:13px; color:var(--text-muted); margin-top:8px;">
            To inspect the script before running: <a class="text-link" href="install.sh" download="install.sh">Download install.sh</a>.
            Pass <code>--uninstall</code> to safely remove an unchanged installation.
          </p>
        </section>

        <!-- Prebuilt Binaries -->
        <section class="doc-section" id="inst-binaries">
          <h2>Prebuilt Binaries (Release v${tarnVersion})</h2>
          <p>You can also download release assets directly from GitHub:</p>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Asset</th><th>Description</th><th>Link</th></tr></thead>
              <tbody>
${tarnRelease.archives.map(arch => `                <tr>
                  <td><code>tarn-${tarnVersion}-linux-${arch}.tar.gz</code></td>
                  <td>Compiler, LSP server, and licenses for ${archLabels[arch] || arch}</td>
                  <td><a class="text-link" href="${releaseDownload}tarn-${tarnVersion}-linux-${arch}.tar.gz">Download .tar.gz ↗</a></td>
                </tr>
`).join('')}                <tr>
                  <td><code>SHA256SUMS</code></td>
                  <td>SHA-256 checksums for every archive</td>
                  <td><a class="text-link" href="${releaseDownload}SHA256SUMS">Download SHA256SUMS ↗</a></td>
                </tr>
                <tr>
                  <td><code>install.sh</code></td>
                  <td>Standalone POSIX installer</td>
                  <td><a class="text-link" href="${releaseDownload}install.sh">Download install.sh ↗</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Verification -->
        <section class="doc-section" id="inst-verify">
          <h2>Manual SHA-256 Verification</h2>
          <p>Verify archive integrity manually before extraction:</p>
          ${codeBlock(`# x86_64 or aarch64, matching \`uname -m\`:
ARCH=x86_64
curl -sLO ${releaseDownload}tarn-${tarnVersion}-linux-$ARCH.tar.gz
curl -sLO ${releaseDownload}SHA256SUMS
# SHA256SUMS lists every architecture; check only the archive you downloaded:
grep " tarn-${tarnVersion}-linux-$ARCH.tar.gz$" SHA256SUMS | sha256sum --check --strict

# Extract binaries:
mkdir -p ~/.local/bin
tar -xzf tarn-${tarnVersion}-linux-$ARCH.tar.gz -C ~/.local/bin`, 'bash')}
        </section>

        <!-- Build from source -->
        <section class="doc-section" id="inst-source">
          <h2>Build from Source</h2>
          <p>If you prefer building from source, clone the repository and build with Rust 2024 edition:</p>
          ${codeBlock(`git clone https://github.com/tarn-lng/tarn.git
cd tarn
cargo build --release -p tarn -p tarn-lsp

# Binaries are placed in target/release/
./target/release/tarn --help`, 'bash')}
        </section>

        <!-- Requirements -->
        <section class="doc-section" id="inst-reqs">
          <h2>System Requirements</h2>
          <ul>
            <li><strong>Operating System:</strong> Linux x86_64 or ARM64 (aarch64), 64-bit little-endian</li>
            <li><strong>C Library:</strong> glibc 2.35 or newer</li>
            <li><strong>Native Toolchain:</strong> <code>cc</code> (gcc or clang) and libc development headers for native linking</li>
          </ul>
        </section>
      </main>
    </div>
  `,

  docs: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">Documentation</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="#docs-specs">Specifications</a>
          <a class="sidebar-link" href="#docs-arch">Architecture</a>
          <a class="sidebar-link" href="#docs-adr">ADRs</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Documentation Index</h1>
        <p class="doc-lead">Canonical documentation and specifications from the official Tarn repository.</p>

        <section class="doc-section" id="docs-specs">
          <h2>Language Specifications</h2>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Document</th><th>Description</th><th>Source</th></tr></thead>
              <tbody>
                <tr><td>Language Reference</td><td>Established syntax and semantics</td><td><a class="text-link" href="${repoRoot}docs/language.md" target="_blank">docs/language.md ↗</a></td></tr>
                <tr><td>Grammar Specification</td><td>Lexical and parser grammar rules</td><td><a class="text-link" href="${repoRoot}docs/grammar.md" target="_blank">docs/grammar.md ↗</a></td></tr>
                <tr><td>Ownership & Borrowing</td><td>Move semantics, loans, and loan conflict checking</td><td><a class="text-link" href="${repoRoot}docs/ownership.md" target="_blank">docs/ownership.md ↗</a></td></tr>
                <tr><td>Diagnostic Error Codes</td><td>Diagnostic catalog with code descriptions and remedies</td><td><a class="text-link" href="${repoRoot}docs/errors.md" target="_blank">docs/errors.md ↗</a></td></tr>
                <tr><td>Guide for Coding Agents</td><td>Prompting conventions and idiomatic code rules for AI</td><td><a class="text-link" href="${repoRoot}docs/llm-guide.md" target="_blank">docs/llm-guide.md ↗</a></td></tr>
                <tr><td>Package System</td><td>Manifest format, lockfile schema, and registry rules</td><td><a class="text-link" href="${repoRoot}docs/packages.md" target="_blank">docs/packages.md ↗</a></td></tr>
                <tr><td>Dependency Security</td><td>Supply-chain security and proof validation</td><td><a class="text-link" href="${repoRoot}docs/dependency-security.md" target="_blank">docs/dependency-security.md ↗</a></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="doc-section" id="docs-arch">
          <h2>Compiler Architecture</h2>
          <p>Tarn compiler pipeline is strictly sequential:</p>
          <div class="code-box">
            <pre class="code-content"><code>Source → Lexer → Parser → AST → Name Resolution → Type Checker → Typed IR → Move Checker → Borrow Checker → Drop Elaboration → Cranelift Backend</code></pre>
          </div>
          <p><a class="text-link" href="${repoRoot}docs/architecture.md" target="_blank">Read full architecture documentation ↗</a></p>
        </section>

        <section class="doc-section" id="docs-adr">
          <h2>Architecture Decision Records (ADRs)</h2>
          <p>Key technical choices are documented as immutable ADRs:</p>
          <ul>
            <li><a class="text-link" href="${repoRoot}docs/adr/0027-executable-drops.md" target="_blank">ADR 0027: Executable Drops & Cranelift Backend</a></li>
            <li><a class="text-link" href="${repoRoot}docs/adr/0032-move-closures.md" target="_blank">ADR 0032: Move Closures and Callable Types</a></li>
            <li><a class="text-link" href="${repoRoot}docs/adr/0033-safe-native-tasks.md" target="_blank">ADR 0033: Safe Native Concurrency & Tasks</a></li>
            <li><a class="text-link" href="${repoRoot}docs/adr/0034-blocking-networking.md" target="_blank">ADR 0034: Blocking Networking in stdlib/net</a></li>
            <li><a class="text-link" href="${repoRoot}docs/adr/0037-source-async.md" target="_blank">ADR 0037: Source Async/Await Lowering</a></li>
            <li><a class="text-link" href="${repoRoot}docs/adr/0041-stdlib-layering.md" target="_blank">ADR 0041: Stdlib Module Layering & Trusted Core</a></li>
          </ul>
        </section>
      </main>
    </div>
  `,

  llms: () => `
    <div class="doc-layout">
      <aside class="doc-sidebar">
        <div class="sidebar-title">For LLMs &amp; Agents</div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="#llm-overview">Overview</a>
          <a class="sidebar-link" href="#llm-endpoints">llms.txt Endpoints</a>
          <a class="sidebar-link" href="#llm-prompt">System Prompt</a>
          <a class="sidebar-link" href="#llm-compiler">Compiler Introspection</a>
          <a class="sidebar-link" href="#llm-rules">Rules &amp; Pitfalls</a>
        </nav>
      </aside>

      <main class="doc-main">
        <h1>Tarn for AI Coding Agents</h1>
        <p class="doc-lead">Tarn is designed from day one with first-class support for autonomous coding agents, LLMs, and AI pair-programming.</p>

        <section class="doc-section" id="llm-overview">
          <h2>Why Tarn for AI Pair-Programming?</h2>
          <p>Traditional systems languages (like Rust or C++) present steep friction for coding agents due to lifetime annotation puzzles, macro complexity, or implicit conversions. Tarn solves this by design:</p>
          <ul>
            <li><strong>Inferred Lifetimes:</strong> Zero explicit lifetime syntax (no <code>'a</code>). LLMs never hallucinate broken lifetime parameters.</li>
            <li><strong>Regular, Predictable Grammar:</strong> No semicolons, explicit <code>return</code>, prefix <code>try</code>, and explicit types.</li>
            <li><strong>Machine-Readable Facts:</strong> <code>tarn check --json</code> provides structured diagnostics with precise line, column, error code, and actionable fixes.</li>
            <li><strong>Zero Guesswork on APIs:</strong> <code>tarn stdlib --json</code> emits embedded signatures directly from the compiler binary.</li>
          </ul>
        </section>

        <section class="doc-section" id="llm-endpoints">
          <h2>Standard llms.txt Endpoints</h2>
          <p>Tarn serves the official <a class="text-link" href="https://llmstxt.org" target="_blank" rel="noopener">llms.txt</a> standard files for AI assistants and context windows:</p>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Endpoint</th><th>Purpose</th><th>Link</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>/llms.txt</code></td>
                  <td>Concise language rules, syntax cheatsheet, and documentation links</td>
                  <td><a class="text-link" href="llms.txt" target="_blank">llms.txt ↗</a></td>
                </tr>
                <tr>
                  <td><code>/llms-full.txt</code></td>
                  <td>Complete, dense specification and standard library API catalog</td>
                  <td><a class="text-link" href="llms-full.txt" target="_blank">llms-full.txt ↗</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="doc-section" id="llm-prompt">
          <h2>Copyable System Prompt for Coding Agents</h2>
          <p>Paste this preamble into Cursor, Claude Code, ChatGPT, Windsurf, or GitHub Copilot when generating Tarn code:</p>
          ${codeBlock(`You are an expert programming assistant working with the Tarn programming language (v${tarnVersion}, Linux x86_64 and ARM64).
Always follow these strict Tarn rules:
1. No semicolons: Statements end with line breaks.
2. Explicit return: Functions require an explicit 'return'. Blocks, 'if', and 'match' are statements, not expressions.
3. Bindings: Immutable 'x := val', mutable 'var x: Type = val'.
4. Parameters: Types follow names directly without colons: 'fn add(a i32, b i32) i32'.
5. Inherent methods: Declared directly on the type: 'fn User.greet(&self)'. Never use 'impl User { ... }' for inherent methods.
6. Interfaces: Nominal implementation with 'impl Interface for Type'. Dynamic dispatch uses '&any Interface'.
7. Ownership: Non-Copy types move on assignment and call. Lifetimes are inferred by the compiler (never write ''a').
8. Errors: Uses Result<T, E> and Option<T>. Prefix 'try' propagates errors (e.g. 'v := try op()'). Never use '?'.
9. Loops: Only use 'for' ('for i in 0..10', 'for cond', 'for { break }').
10. Slices: Arrays '[N]T', borrowed slices '&[]T'.
11. No compound assignment: Operators like += or -= do not exist in v0; use 'x = x + 1'.
12. Introspection: Always verify code with 'tarn check <file> --json' and discover APIs with 'tarn stdlib [module] --json'.`, 'markdown', 'System Prompt for LLMs')}
        </section>

        <section class="doc-section" id="llm-compiler">
          <h2>Compiler Introspection for Agents</h2>
          <p>Agents should consume compiler facts instead of guessing:</p>
          ${codeBlock(`$ tarn stdlib collections --json
$ tarn check src/main.tarn --json`, 'bash')}
          <p>Exit code <code>0</code> indicates success. Non-zero exit with structured JSON allows agents to pinpoint errors and apply targeted fixes.</p>
        </section>

        <section class="doc-section" id="llm-rules">
          <h2>Common LLM Hallucinations &amp; Corrections</h2>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Common Hallucination</th><th>Tarn Requirement</th><th>Correct Example</th></tr></thead>
              <tbody>
                <tr><td>Postfix <code>?</code> operator</td><td>Prefix <code>try</code> operator</td><td><code>val := try file.read_all()</code></td></tr>
                <tr><td><code>impl Struct { ... }</code></td><td>Inherent method declaration</td><td><code>fn Struct.method(&self)</code></td></tr>
                <tr><td>Explicit lifetimes (<code>'a</code>)</td><td>Inferred provenance</td><td><code>fn pick(a &Item, b &Item) &Item</code></td></tr>
                <tr><td>Compound <code>+=</code>, <code>-=</code></td><td>Explicit assignment</td><td><code>x = x + 1</code></td></tr>
                <tr><td>Semicolons <code>;</code></td><td>Line breaks</td><td>Newline separated statements</td></tr>
                <tr><td>Implicit numeric coercion</td><td>Explicit conversion</td><td><code>usize(count)</code> or <code>i64(num)</code></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  `
};

/**
 * Render Active Tab in Showcase
 */
function renderShowcaseTab(tabId) {
  const panel = $('#tab-content-panel');
  if (!panel) return;
  const tab = showcaseTabs.find((t) => t.id === tabId) || showcaseTabs[0];

  panel.innerHTML = `
    <div class="tab-pane-code">
      <pre><code>${highlightTarn(tab.code)}</code></pre>
    </div>
    <div class="tab-pane-desc">
      <div>
        <h3>${escapeHtml(tab.title)}</h3>
        <p>${escapeHtml(tab.desc)}</p>
        <ul>
          ${tab.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      </div>
      <div class="tab-footer-meta">
        <span>✓ ${escapeHtml(tab.verified)}</span>
        <a class="text-link" href="#tour">Learn more →</a>
      </div>
    </div>
  `;
}

/**
 * Markdown Renderer for Package READMEs
 */
function renderMarkdown(md) {
  if (!md) return '';
  let text = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_\-\.\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: (lang || 'tarn').trim().toLowerCase(), code: code.replace(/\n$/, '') });
    return id;
  });

  const lines = text.split('\n');
  const out = [];
  let inList = null;
  let inTable = false;
  let tableHeader = [];
  let tableRows = [];

  function closeList() {
    if (inList) {
      out.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  }

  function closeTable() {
    if (inTable || tableHeader.length > 0) {
      let html = '<div class="table-wrap"><table class="doc-table">';
      if (tableHeader.length) {
        html += '<thead><tr>' + tableHeader.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>';
      }
      if (tableRows.length) {
        html += '<tbody>' + tableRows.map(row => '<tr>' + row.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>';
      }
      html += '</table></div>';
      out.push(html);
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  }

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-link" href="$2" target="_blank" rel="noopener">$1 ↗</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\*])\*([^*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cbMatch = line.trim().match(/^__CODE_BLOCK_(\d+)__$/);
    if (cbMatch) {
      closeList();
      closeTable();
      const cb = codeBlocks[parseInt(cbMatch[1], 10)];
      out.push(codeBlock(cb.code, cb.lang));
      continue;
    }

    if (/^(\-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      closeTable();
      out.push('<hr class="readme-hr">');
      continue;
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      closeList();
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable) {
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      closeTable();
    }

    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      out.push(`<h${level}>${inline(hMatch[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith('>')) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }

    const ulMatch = line.match(/^(\s*)[-\*]\s+(.*)$/);
    if (ulMatch) {
      if (inList !== 'ul') {
        closeList();
        out.push('<ul>');
        inList = 'ul';
      }
      out.push(`<li>${inline(ulMatch[2])}</li>`);
      continue;
    }

    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== 'ol') {
        closeList();
        out.push('<ol>');
        inList = 'ol';
      }
      out.push(`<li>${inline(olMatch[2])}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  closeTable();

  return out.join('\n');
}

/**
 * Render Dedicated Package Detail Page with README.md
 */
async function renderPackagePage(pkgName, requestedVer) {
  const content = $('#content');
  if (!content) return;

  content.innerHTML = `
    <div style="max-width:var(--max-width); margin:0 auto; padding:40px 24px;">
      <a class="text-link" href="#packages" style="margin-bottom:24px; display:inline-flex; align-items:center; gap:6px;">
        ← Back to Packages
      </a>
      <div style="text-align:center; padding:60px 0; color:var(--text-muted);">
        <div class="spinner" style="margin:0 auto 16px;"></div>
        <p>Loading package details for <code>${escapeHtml(pkgName)}</code>…</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch('catalog.json');
    if (!res.ok) throw new Error('Catalog HTTP error');
    const data = await res.json();
    const all = data.packages || [];
    const matching = all.filter((p) => p.name.toLowerCase() === pkgName.toLowerCase());

    if (!matching.length) {
      content.innerHTML = `
        <div style="max-width:var(--max-width); margin:0 auto; padding:40px 24px;">
          <a class="text-link" href="#packages" style="margin-bottom:24px; display:inline-flex;">← Back to Packages</a>
          <h1 style="margin:20px 0 10px;">Package not found: <code>${escapeHtml(pkgName)}</code></h1>
          <p style="color:var(--text-muted);">This package is not present in the current Tarn package registry.</p>
          <a class="btn btn-secondary btn-sm" href="#packages" style="margin-top:16px;">Browse All Packages</a>
        </div>
      `;
      return;
    }

    // Sort newest first
    const sorted = matching.slice().reverse();
    const selected = requestedVer ? (sorted.find(r => r.version === requestedVer) || sorted[0]) : sorted[0];
    const latestVersion = sorted[0].version;

    document.title = `${selected.name} v${selected.version} — Tarn Package Registry`;

    content.innerHTML = `
      <div style="max-width:var(--max-width); margin:0 auto; padding:40px 24px;">
        <div style="margin-bottom:28px;">
          <a class="text-link" href="#packages" style="display:inline-flex; align-items:center; gap:6px; font-size:14px; margin-bottom:18px;">
            ← Back to all packages
          </a>
          <div class="pkg-header-layout">
            <div>
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                <span class="pkg-badge status">${escapeHtml(selected.status || 'experimental')}</span>
                <span class="pkg-badge">v${escapeHtml(selected.version)}</span>
                ${selected.version === latestVersion ? '<span class="pkg-badge" style="color:var(--color-green); border-color:rgba(101,197,156,0.35); background:rgba(101,197,156,0.08);">latest</span>' : ''}
                <span class="pkg-badge">Linux x86_64 · ARM64</span>
                ${selected.nativeLink ? `<span class="pkg-badge native">lib: ${escapeHtml(selected.nativeLink)}</span>` : ''}
              </div>
              <h1 style="font-size:38px; font-weight:800; margin:0 0 12px; letter-spacing:-0.5px;">${escapeHtml(selected.name)}</h1>
              <p style="font-size:17px; color:var(--text-muted); max-width:820px; margin:0; line-height:1.5;">${escapeHtml(selected.description)}</p>
            </div>
            <div class="pkg-ver-picker">
              <label for="pkg-ver-select" style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono); display:block; margin-bottom:6px;">Version:</label>
              <select id="pkg-ver-select" class="pkg-select-styled">
                ${sorted.map(r => `<option value="${escapeHtml(r.version)}" ${r.version === selected.version ? 'selected' : ''}>v${escapeHtml(r.version)} ${r.version === latestVersion ? '(latest)' : ''}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="pkg-detail-grid">
          <div class="pkg-main-column">
            <div class="readme-card">
              <div class="readme-header">
                <div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:13px; font-family:var(--font-mono);">
                  <span>📄</span>
                  <span>README.md</span>
                  <span class="pkg-badge" style="padding:1px 5px; font-size:10px;">v${escapeHtml(selected.version)}</span>
                </div>
                <a class="text-link" href="${registryBase}${encodeURIComponent(selected.name)}/${encodeURIComponent(selected.version)}/files/README.md" target="_blank" rel="noopener" style="font-size:12px;">Raw ↗</a>
              </div>
              <div id="pkg-readme-content" class="readme-prose">
                <div style="text-align:center; padding:60px 0; color:var(--text-muted);">
                  <div class="spinner" style="margin:0 auto 16px;"></div>
                  <p>Loading README.md…</p>
                </div>
              </div>
            </div>
          </div>

          <aside class="pkg-sidebar-column">
            <div class="pkg-sidebar-card">
              <div class="sidebar-heading">Install</div>
              ${codeBlock(`tarn add ${selected.name} --registry ${registryBase}${selected.nativeLink ? `\ntarn build --link ${selected.nativeLink}` : ''}`, 'bash')}
            </div>

            <div class="pkg-sidebar-card">
              <div class="sidebar-heading">Repository</div>
              <a class="text-link" href="${escapeHtml(selected.repository)}" target="_blank" rel="noopener" style="font-size:14px; word-break:break-all;">
                ${escapeHtml(selected.repository ? selected.repository.replace('https://github.com/', '') : 'Source repository')} ↗
              </a>
            </div>

            <div class="pkg-sidebar-card">
              <div class="sidebar-heading">Metadata</div>
              <ul class="meta-list">
                <li><span>Version</span><strong>v${escapeHtml(selected.version)}</strong></li>
                <li><span>Dependencies</span><strong>${selected.dependencies || 0} direct</strong></li>
                <li><span>Platform</span><strong>Linux x86_64 · ARM64</strong></li>
                ${selected.nativeLink ? `<li><span>Native Link</span><strong><code>${escapeHtml(selected.nativeLink)}</code></strong></li>` : ''}
                <li><span>Release Record</span><a class="text-link" href="${registryBase}${encodeURIComponent(selected.name)}/${encodeURIComponent(selected.version)}/release.json" target="_blank" rel="noopener">release.json ↗</a></li>
              </ul>
            </div>

            <div class="pkg-sidebar-card">
              <div class="sidebar-heading">Integrity SHA-256</div>
              <div class="hash-box">
                <code>${escapeHtml(selected.hash)}</code>
                <button class="btn-copy" type="button" aria-label="Copy hash" style="padding:2px 6px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy
                </button>
              </div>
            </div>

            <div class="pkg-sidebar-card">
              <div class="sidebar-heading">Versions (${sorted.length})</div>
              <div class="version-history-list">
                ${sorted.map(r => `
                  <a href="#package-${encodeURIComponent(r.name)}/${encodeURIComponent(r.version)}" class="version-pill ${r.version === selected.version ? 'current' : ''}">
                    <span>v${escapeHtml(r.version)}</span>
                    ${r.version === latestVersion ? '<span class="pkg-badge" style="font-size:9px; padding:1px 4px; color:var(--color-green);">latest</span>' : ''}
                  </a>
                `).join('')}
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    // Dropdown listener
    const sel = $('#pkg-ver-select');
    if (sel) {
      sel.addEventListener('change', (e) => {
        location.hash = `#package-${encodeURIComponent(selected.name)}/${encodeURIComponent(e.target.value)}`;
      });
    }

    // Fetch README.md from registry
    const readmeUrl = `${registryBase}${encodeURIComponent(selected.name)}/${encodeURIComponent(selected.version)}/files/README.md`;
    const readmeEl = $('#pkg-readme-content');
    try {
      const readmeRes = await fetch(readmeUrl);
      if (!readmeRes.ok) throw new Error('README not found');
      const md = await readmeRes.text();
      if (readmeEl) {
        readmeEl.innerHTML = renderMarkdown(md);
      }
    } catch (err) {
      if (readmeEl) {
        readmeEl.innerHTML = `
          <div style="padding:32px 24px; color:var(--text-muted); text-align:center;">
            <p style="margin:0 0 10px;">README.md is not available for this release package.</p>
            <a class="text-link" href="${escapeHtml(selected.repository)}" target="_blank" rel="noopener">Visit GitHub Repository ↗</a>
          </div>
        `;
      }
    }
  } catch (e) {
    content.innerHTML = `
      <div style="max-width:var(--max-width); margin:0 auto; padding:40px 24px;">
        <a class="text-link" href="#packages">← Back to Packages</a>
        <h2 style="margin:24px 0 10px;">Could not load catalog</h2>
        <p style="color:var(--text-muted);">Network error while loading package data. Please try again.</p>
      </div>
    `;
  }
}

/**
 * Render Package Catalog (Scalable dense list with search, filter, sort, pagination)
 */
async function loadCatalog() {
  const listEl = $('#pkg-list');
  const statusEl = $('#pkg-status');
  const paginationEl = $('#pkg-pagination');
  if (!listEl || !statusEl) return;

  try {
    const res = await fetch('catalog.json');
    if (!res.ok) throw new Error('Catalog HTTP error');
    const data = await res.json();
    const allPackages = data.packages || [];

    let currentQuery = '';
    let currentFilter = 'all';
    let currentSort = 'name-asc';
    let currentPage = 1;
    const pageSize = 15;

    function updateView() {
      // 1. Group by package name to show latest version per package
      const byName = new Map();
      for (const p of allPackages) {
        if (!byName.has(p.name)) byName.set(p.name, []);
        byName.get(p.name).push(p);
      }
      const groupedPackages = [...byName.values()].map(releases => {
        const latest = releases[releases.length - 1];
        latest._releasesCount = releases.length;
        return latest;
      });

      // Filter
      let filtered = groupedPackages.filter((p) => {
        const matchesQuery = (p.name + ' ' + p.description + ' ' + (p.nativeLink || '')).toLowerCase().includes(currentQuery);
        if (!matchesQuery) return false;
        if (currentFilter === 'native') return Boolean(p.nativeLink);
        if (currentFilter === 'pure') return !p.nativeLink;
        return true;
      });

      // 2. Sort
      filtered.sort((a, b) => {
        if (currentSort === 'name-asc') return a.name.localeCompare(b.name);
        if (currentSort === 'name-desc') return b.name.localeCompare(a.name);
        if (currentSort === 'recent') return (b.published || 0) - (a.published || 0);
        return 0;
      });

      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / pageSize) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      // 3. Slice for pagination
      const startIndex = (currentPage - 1) * pageSize;
      const pageItems = filtered.slice(startIndex, startIndex + pageSize);

      // Status text
      if (totalItems === 0) {
        statusEl.textContent = '0 packages found matching your criteria.';
        listEl.innerHTML = '<p style="color:var(--text-muted); padding:24px 0; text-align:center;">No matching packages found.</p>';
        paginationEl.innerHTML = '';
        return;
      }

      const endDisplay = Math.min(startIndex + pageSize, totalItems);
      statusEl.textContent = `Showing ${startIndex + 1}–${endDisplay} of ${totalItems} package${totalItems === 1 ? '' : 's'} · Verified immutable source`;

      // Render Rows
      listEl.innerHTML = pageItems.map((p) => {
        const hashDisplay = p.hash && p.hash.length > 16 ? `${p.hash.slice(0, 8)}…${p.hash.slice(-8)}` : (p.hash || '');
        const versionsBadge = p._releasesCount > 1 ? `<span class="pkg-badge" style="color:var(--accent); border-color:rgba(63,176,207,0.3);">${p._releasesCount} versions</span>` : '';
        return `
          <article class="pkg-row" data-pkg="${escapeHtml(p.name)}">
            <div class="pkg-row-top">
              <div class="pkg-title-group">
                <a class="pkg-name-link" href="#package-${escapeHtml(p.name)}">${escapeHtml(p.name)}</a>
                <span class="pkg-badge">v${escapeHtml(p.version)}</span>
                ${versionsBadge}
                <span class="pkg-badge status">${escapeHtml(p.status || 'stable')}</span>
                ${p.nativeLink ? `<span class="pkg-badge native" title="Requires native C library --link ${escapeHtml(p.nativeLink)}">lib: ${escapeHtml(p.nativeLink)}</span>` : ''}
              </div>
              <div class="pkg-quick-copy">
                <code>tarn add ${escapeHtml(p.name)}</code>
                <button class="btn-copy" type="button" aria-label="Copy install command" style="padding:2px 6px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy
                </button>
              </div>
            </div>
            <p class="pkg-desc">${escapeHtml(p.description)}</p>
            <div class="pkg-meta-row">
              <div class="pkg-meta-items">
                <span>Linux x86_64 · ARM64</span>
                <span>${p.dependencies || 0} dependencies</span>
                <span title="${escapeHtml(p.hash)}">SHA-256: <code>${hashDisplay}</code></span>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <a class="text-link" href="${p.repository}" target="_blank" rel="noopener">Source ↗</a>
                <a class="text-link" href="#package-${escapeHtml(p.name)}" style="font-weight:600;">Readme &amp; Docs →</a>
                <button class="pkg-details-toggle" type="button">▾ Details</button>
              </div>
            </div>
            <div class="pkg-expanded-drawer">
              <p style="font-size:13px; color:var(--text-muted); margin:0 0 8px;">Manifest dependency &amp; native build command:</p>
              ${codeBlock(`tarn add ${p.name} --registry ${registryBase}${p.nativeLink ? `\ntarn build --link ${p.nativeLink}` : ''}`, 'bash')}
              <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <a class="btn btn-primary btn-sm" href="#package-${escapeHtml(p.name)}" style="display:inline-flex; align-items:center; gap:6px;">
                  📄 View README &amp; Documentation →
                </a>
                <div style="font-size:12px; color:var(--text-dim); display:flex; gap:12px;">
                  <span>Full SHA-256: <code>${escapeHtml(p.hash)}</code></span>
                  <a class="text-link" href="${registryBase}${encodeURIComponent(p.name)}/${encodeURIComponent(p.version)}/release.json" target="_blank">release.json ↗</a>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join('');

      // Attach details drawer toggle listeners
      listEl.querySelectorAll('.pkg-details-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.pkg-row');
          const drawer = row.querySelector('.pkg-expanded-drawer');
          if (!drawer) return;
          const isOpen = drawer.classList.toggle('open');
          btn.textContent = isOpen ? '▴ Less' : '▾ Details';
        });
      });

      // Render Pagination Controls
      if (totalPages > 1) {
        let pagesHtml = `
          <div class="pagination-bar">
            <span>Page ${currentPage} of ${totalPages}</span>
            <div class="pagination-pages">
              <button class="page-btn" type="button" data-goto="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>« Prev</button>
        `;

        for (let i = 1; i <= totalPages; i++) {
          if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
            if (i === 2 || i === totalPages - 1) pagesHtml += '<span style="color:var(--text-dim);">…</span>';
            continue;
          }
          pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" type="button" data-goto="${i}">${i}</button>`;
        }

        pagesHtml += `
              <button class="page-btn" type="button" data-goto="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>Next »</button>
            </div>
          </div>
        `;
        paginationEl.innerHTML = pagesHtml;

        paginationEl.querySelectorAll('.page-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const targetPage = parseInt(btn.dataset.goto, 10);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
              currentPage = targetPage;
              updateView();
              window.scrollTo({ top: listEl.offsetTop - 80, behavior: 'smooth' });
            }
          });
        });
      } else {
        paginationEl.innerHTML = '';
      }
    }

    // Event Listeners for Controls
    const searchInput = $('#pkg-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim().toLowerCase();
        currentPage = 1;
        updateView();
      });
    }

    const filterContainer = $('#pkg-filters');
    if (filterContainer) {
      filterContainer.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          filterContainer.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          currentFilter = btn.dataset.filter;
          currentPage = 1;
          updateView();
        });
      });
    }

    const sortSelect = $('#pkg-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        updateView();
      });
    }

    // Initial render
    updateView();
  } catch (err) {
    statusEl.textContent = 'Could not load registry catalog. Please reload or visit the registry repository.';
  }
}

/**
 * Route Dispatcher
 */
function navigate() {
  const rawHash = location.hash.replace(/^#/, '');

  // Handle Dedicated Package Detail Routes (#package-NAME or #package/NAME)
  if (rawHash.startsWith('package/') || rawHash.startsWith('package-')) {
    const rest = rawHash.replace(/^package[\/-]/, '');
    const pkgName = rest.split('/')[0];
    const pkgVer = rest.split('/')[1] || null;
    renderPackagePage(pkgName, pkgVer);

    // Update navigation link states (highlight 'Packages' tab)
    $$('nav.main-nav a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === '#packages');
    });
    window.scrollTo(0, 0);
    return;
  }

  const route = rawHash.split('-')[0] || 'home';
  const renderFn = pages[route] || pages.home;

  const content = $('#content');
  if (content) {
    content.innerHTML = renderFn();
  }

  // Update navigation link states
  $$('nav.main-nav a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const linkRoute = href.replace(/^#/, '').split('-')[0];
    a.classList.toggle('active', linkRoute === route);
  });

  // Handle Home Showcase Tabs
  if (route === 'home') {
    renderShowcaseTab('ownership');
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderShowcaseTab(btn.dataset.tab);
      });
    });
  }

  // Handle Package Registry Fetch
  if (route === 'packages') {
    loadCatalog();
  }

  // Scroll to section anchor if present
  if (rawHash.includes('-')) {
    const target = $(`#${rawHash}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  window.scrollTo(0, 0);
}

// Global Copy Button Click Handler
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-copy');
  if (!btn) return;
  const parent = btn.closest('.code-box') || btn.closest('.terminal-card');
  if (!parent) return;

  const codeEl = parent.querySelector('code');
  if (!codeEl) return;

  // Extract raw text without prompt symbols
  let text = codeEl.innerText.replace(/^\$\s*/gm, '');

  try {
    await navigator.clipboard.writeText(text.trim());
    const originalHtml = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Copied!
    `;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalHtml;
    }, 1800);
  } catch (err) {
    btn.textContent = 'Failed';
  }
});

// Initialization
window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', () => {
  navigate();
  loadLatestRelease().then(changed => { if (changed) navigate(); });
});
