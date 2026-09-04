import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'samples');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Delhi Urban
const delhiLow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <filter id="pixelate10m">
      <feGaussianBlur stdDeviation="3" />
    </filter>
  </defs>
  <rect width="800" height="800" fill="#2d3748" />
  <!-- River Yamuna -->
  <path d="M 550,0 Q 600,300 500,500 T 450,800" fill="none" stroke="#2b6cb0" stroke-width="45" filter="url(#pixelate10m)" />
  <!-- Urban Grid Low Res Blocks -->
  <g opacity="0.8" filter="url(#pixelate10m)">
    ${Array.from({ length: 16 }).map((_, i) => 
      Array.from({ length: 16 }).map((_, j) => {
        const x = i * 50;
        const y = j * 50;
        const col = (i + j) % 3 === 0 ? '#4a5568' : (i * j) % 4 === 0 ? '#718096' : '#39424e';
        return `<rect x="${x}" y="${y}" width="48" height="48" fill="${col}" />`;
      }).join('')
    ).join('')}
  </g>
  <!-- Main Arterials Blurry -->
  <path d="M 0,250 L 800,280" stroke="#a0aec0" stroke-width="12" opacity="0.7" filter="url(#pixelate10m)" />
  <path d="M 0,550 L 800,520" stroke="#a0aec0" stroke-width="14" opacity="0.7" filter="url(#pixelate10m)" />
  <path d="M 280,0 L 290,800" stroke="#cbd5e0" stroke-width="16" opacity="0.7" filter="url(#pixelate10m)" />
</svg>`;

const delhiHigh = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" fill="#1a202c" />
  <!-- River Yamuna with sediment textures -->
  <path d="M 550,0 Q 600,300 500,500 T 450,800" fill="none" stroke="#3182ce" stroke-width="40" />
  <path d="M 552,0 Q 602,300 502,500 T 452,800" fill="none" stroke="#2b6cb0" stroke-width="20" />
  <path d="M 545,0 Q 595,300 495,500 T 445,800" fill="none" stroke="#63b3ed" stroke-width="4" stroke-dasharray="8,8" />
  <!-- High Res Urban Blocks & Rooftops -->
  <g opacity="0.9">
    ${Array.from({ length: 32 }).map((_, i) => 
      Array.from({ length: 32 }).map((_, j) => {
        const x = i * 25 + 2;
        const y = j * 25 + 2;
        const col = (i + j) % 5 === 0 ? '#4a5568' : (i * j) % 3 === 0 ? '#718096' : (i + 2*j)%4 === 0 ? '#a0aec0' : '#2d3748';
        const roof = (i * 7 + j * 13) % 4 === 0 ? '#e2e8f0' : (i + j) % 2 === 0 ? '#90cdf4' : '#cbd5e0';
        return `
          <rect x="${x}" y="${y}" width="21" height="21" fill="${col}" rx="1" />
          <rect x="${x+3}" y="${y+3}" width="15" height="15" fill="${roof}" opacity="0.8" />
          <circle cx="${x+10}" cy="${y+10}" r="2" fill="#2d3748" opacity="0.5"/>
        `;
      }).join('')
    ).join('')}
  </g>
  <!-- Sharp Road Grid -->
  ${Array.from({ length: 9 }).map((_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="800" stroke="#10141d" stroke-width="6" />`).join('')}
  ${Array.from({ length: 9 }).map((_, i) => `<line x1="0" y1="${i * 100}" x2="800" y2="${i * 100}" stroke="#10141d" stroke-width="6" />`).join('')}
  <!-- Expressways with lane markings -->
  <path d="M 0,250 L 800,280" stroke="#f7fafc" stroke-width="8" />
  <path d="M 0,250 L 800,280" stroke="#e53e3e" stroke-width="2" stroke-dasharray="6,6" />
  <path d="M 0,550 L 800,520" stroke="#f7fafc" stroke-width="10" />
  <path d="M 280,0 L 290,800" stroke="#f7fafc" stroke-width="10" />
  <path d="M 280,0 L 290,800" stroke="#ecc94b" stroke-width="2" stroke-dasharray="5,5" />
</svg>`;

const delhiUncertainty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="uncGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38a169" stop-opacity="0.3" />
      <stop offset="50%" stop-color="#d69e2e" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#e53e3e" stop-opacity="0.8" />
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="#1a202c" opacity="0.6" />
  <!-- Low variance in water -->
  <path d="M 550,0 Q 600,300 500,500 T 450,800" fill="none" stroke="#38a169" stroke-width="45" opacity="0.5" />
  <!-- High variance along complex urban edge boundaries -->
  ${Array.from({ length: 16 }).map((_, i) => 
    Array.from({ length: 16 }).map((_, j) => {
      const x = i * 50;
      const y = j * 50;
      const unc = (i * 3 + j * 7) % 5 === 0 ? '#e53e3e' : (i + j) % 2 === 0 ? '#d69e2e' : '#38a169';
      const op = unc === '#e53e3e' ? 0.75 : unc === '#d69e2e' ? 0.5 : 0.25;
      return `<rect x="${x}" y="${y}" width="48" height="48" fill="${unc}" opacity="${op}" />`;
    }).join('')
  ).join('')}
</svg>`;

// 2. Punjab Agriculture
const punjabLow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <filter id="blurAgri">
      <feGaussianBlur stdDeviation="4" />
    </filter>
  </defs>
  <rect width="800" height="800" fill="#22543d" />
  <g filter="url(#blurAgri)">
    ${Array.from({ length: 8 }).map((_, i) => 
      Array.from({ length: 8 }).map((_, j) => {
        const x = i * 100;
        const y = j * 100;
        const col = (i + j) % 3 === 0 ? '#276749' : (i * 2 + j) % 2 === 0 ? '#38a169' : (i + j) % 5 === 0 ? '#975a16' : '#2f855a';
        return `<rect x="${x}" y="${y}" width="98" height="98" fill="${col}" />`;
      }).join('')
    ).join('')}
  </g>
  <path d="M 100,0 L 700,800" stroke="#3182ce" stroke-width="12" opacity="0.6" filter="url(#blurAgri)"/>
</svg>`;

const punjabHigh = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" fill="#1c4532" />
  <g>
    ${Array.from({ length: 24 }).map((_, i) => 
      Array.from({ length: 24 }).map((_, j) => {
        const x = i * 33.3 + 1;
        const y = j * 33.3 + 1;
        const col = (i + j) % 4 === 0 ? '#22543d' : (i * 3 + j) % 3 === 0 ? '#2f855a' : (i + j) % 7 === 0 ? '#b7791f' : '#38a169';
        return `
          <rect x="${x}" y="${y}" width="31" height="31" fill="${col}" />
          <line x1="${x}" y1="${y}" x2="${x+31}" y2="${y}" stroke="#1a202c" stroke-width="1" opacity="0.4"/>
          <line x1="${x}" y1="${y}" x2="${x}" y2="${y+31}" stroke="#1a202c" stroke-width="1" opacity="0.4"/>
        `;
      }).join('')
    ).join('')}
  </g>
  <!-- High Res Irrigation Canal with Bunds -->
  <path d="M 100,0 L 700,800" stroke="#d69e2e" stroke-width="10" />
  <path d="M 100,0 L 700,800" stroke="#3182ce" stroke-width="6" />
  <path d="M 0,400 L 800,420" stroke="#cbd5e0" stroke-width="3" stroke-dasharray="10,5" />
</svg>`;

const punjabUncertainty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" fill="#38a169" opacity="0.2" />
  <!-- Low uncertainty inside homogenous fields, higher along canal bunds -->
  <path d="M 100,0 L 700,800" stroke="#e53e3e" stroke-width="16" opacity="0.7" />
  ${Array.from({ length: 8 }).map((_, i) => `<line x1="${i*100}" y1="0" x2="${i*100}" y2="800" stroke="#dd6b20" stroke-width="4" opacity="0.6"/>`).join('')}
  ${Array.from({ length: 8 }).map((_, i) => `<line x1="0" y1="${i*100}" x2="800" y2="${i*100}" stroke="#dd6b20" stroke-width="4" opacity="0.6"/>`).join('')}
</svg>`;

// Write all sample files
const files = {
  'delhi_10m.svg': delhiLow,
  'delhi_2.5m.svg': delhiHigh,
  'delhi_uncertainty.svg': delhiUncertainty,
  'punjab_10m.svg': punjabLow,
  'punjab_2.5m.svg': punjabHigh,
  'punjab_uncertainty.svg': punjabUncertainty,
  'mumbai_10m.svg': delhiLow.replace(/#2b6cb0/g, '#2c5282'),
  'mumbai_2.5m.svg': delhiHigh.replace(/#3182ce/g, '#00b4d8'),
  'mumbai_uncertainty.svg': delhiUncertainty,
  'himalayas_10m.svg': punjabLow.replace(/#22543d/g, '#718096').replace(/#276749/g, '#e2e8f0'),
  'himalayas_2.5m.svg': punjabHigh.replace(/#1c4532/g, '#4a5568').replace(/#2f855a/g, '#f7fafc'),
  'himalayas_uncertainty.svg': punjabUncertainty,
  'ghats_10m.svg': punjabLow.replace(/#22543d/g, '#1a4731'),
  'ghats_2.5m.svg': punjabHigh.replace(/#1c4532/g, '#133524'),
  'ghats_uncertainty.svg': punjabUncertainty,
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, filename), content.trim());
}

console.log('Successfully generated all SVG sample presets in ' + outDir);
