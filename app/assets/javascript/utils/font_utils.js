// Font utilities for signature and initials rendering

// Define available handwriting fonts
export const SIGNATURE_FONTS = {
  handwriting1: {
    name: "Cedarville Cursive",
    family: "'Cedarville Cursive', cursive",
    url: "https://fonts.googleapis.com/css2?family=Cedarville+Cursive&display=swap",
    previewText: "John Doe"
  },
  handwriting2: {
    name: "Dancing Script",
    family: "'Dancing Script', cursive",
    url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500&display=swap",
    previewText: "John Doe"
  },
  handwriting3: {
    name: "Shadows Into Light",
    family: "'Shadows Into Light', cursive",
    url: "https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap", 
    previewText: "John Doe"
  }
};

// Load the fonts - no longer trying to inject them dynamically because of CSP
export function loadSignatureFonts() {
  // We pre-loaded the fonts in the application.html.erb head section
  console.log("Signature fonts already loaded via application layout");
}

// Render text with a specific font on a canvas
export function renderTextWithFont(canvas, text, fontKey, options = {}) {
  const ctx = canvas.getContext('2d');
  const font = SIGNATURE_FONTS[fontKey];
  
  if (!font) {
    console.error(`Font not found: ${fontKey}`);
    return false;
  }
  
  // Clear canvas
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Set font properties
  const fontSize = options.fontSize || Math.min(canvas.height * 0.5, 60);
  ctx.font = `${fontSize}px ${font.family}`;
  ctx.fillStyle = options.color || 'black';
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = 'middle';
  
  // Calculate position
  const x = options.x || canvas.width / 2;
  const y = options.y || canvas.height / 2;
  
  // Draw text
  ctx.fillText(text, x, y);
  
  return true;
}

// Generate a preview of the handwriting fonts for selection
export function createFontPreviews(container, text, options = {}) {
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Create preview for each font - avoid inline style setting due to CSP
  Object.entries(SIGNATURE_FONTS).forEach(([key, font]) => {
    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'font-preview-item p-3 border rounded-md cursor-pointer hover:bg-blue-50';
    previewContainer.setAttribute('data-font-key', key);
    
    // Create font preview - add the font family as a class name instead of inline style
    const preview = document.createElement('div');
    preview.className = `font-preview-text text-center py-3 font-${key}`;
    // Add a custom attribute for the font family instead of inline style
    preview.setAttribute('data-font-family', font.family);
    preview.textContent = text || font.previewText;
    
    // Create font name label
    const label = document.createElement('div');
    label.className = 'font-name text-sm text-center mt-2 text-gray-700';
    label.textContent = font.name;
    
    // Add to container
    previewContainer.appendChild(preview);
    previewContainer.appendChild(label);
    container.appendChild(previewContainer);
    
    // Add click handler
    previewContainer.addEventListener('click', () => {
      if (options.onSelect) {
        options.onSelect(key, font);
      }
      
      // Add selected styling
      document.querySelectorAll('.font-preview-item').forEach(item => {
        item.classList.remove('border-blue-500', 'bg-blue-50');
      });
      previewContainer.classList.add('border-blue-500', 'bg-blue-50');
    });
  });
}

// Generate an image URL from text rendered with a specific font
export function generateSignatureImageUrl(text, fontKey, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width || 400;
  canvas.height = options.height || 150;
  
  renderTextWithFont(canvas, text, fontKey, options);
  
  return canvas.toDataURL('image/png');
}