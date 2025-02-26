/**
 * Utility functions for form field positioning and calculations
 */

/**
 * Calculates the position of a field relative to the PDF page
 * @param {HTMLElement} pdfContainer - The PDF container element
 * @param {Event} event - The mouse event
 * @param {Object} fieldSize - The field size {width, height}
 * @returns {Object} - The position {x, y} in percentage relative to page
 */
export function calculateFieldPosition(pdfContainer, event, fieldSize) {
  const rect = pdfContainer.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  
  return { x, y };
}

/**
 * Converts pixel dimensions to percentages relative to container
 * @param {HTMLElement} container - The container element
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @returns {Object} - The dimensions {width, height} in percentages
 */
export function pixelToPercentage(container, width, height) {
  const containerRect = container.getBoundingClientRect();
  const widthPercent = (width / containerRect.width) * 100;
  const heightPercent = (height / containerRect.height) * 100;
  
  return { width: widthPercent, height: heightPercent };
}

/**
 * Converts percentage dimensions to pixels relative to container
 * @param {HTMLElement} container - The container element
 * @param {number} widthPercent - Width in percentage
 * @param {number} heightPercent - Height in percentage
 * @returns {Object} - The dimensions {width, height} in pixels
 */
export function percentageToPixel(container, widthPercent, heightPercent) {
  const containerRect = container.getBoundingClientRect();
  const width = (widthPercent / 100) * containerRect.width;
  const height = (heightPercent / 100) * containerRect.height;
  
  return { width, height };
}

/**
 * Gets field dimensions based on field type
 * @param {string} fieldType - The type of field
 * @returns {Object} - The dimensions {width, height} in pixels
 */
export function getFieldDimensions(fieldType) {
  switch (fieldType) {
    case 'signature':
      return { width: 200, height: 60 };
    case 'initials':
      return { width: 100, height: 50 };
    case 'text':
      return { width: 150, height: 40 };
    case 'date':
      return { width: 120, height: 40 };
    case 'checkbox':
      return { width: 30, height: 30 };
    default:
      return { width: 150, height: 50 };
  }
} 