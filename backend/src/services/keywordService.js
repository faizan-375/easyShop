const locationTerms = ["price", "best", "online", "affordable", "delivery", "shop"];

function clean(input) {
  return input.replace(/\s+/g, " ").trim();
}

export function generateKeywords(productName, location) {
  const product = clean(productName);
  const place = clean(location);
  const lowerProduct = product.toLowerCase();

  const keywords = [
    `${product} price in ${place}`,
    `best ${product} in ${place}`,
    `${product} online Pakistan`,
    `affordable ${product} ${place}`,
    `${product} price Pakistan`,
    `${product} Daraz ${place}`,
    `${product} sports shop ${place}`,
    `${product} cash on delivery ${place}`
  ];

  if (lowerProduct.includes("bat") || lowerProduct.includes("cricket")) {
    keywords.push(`cricket ${product} price Pakistan`);
  }

  for (const term of locationTerms) {
    keywords.push(`${product} ${term} ${place}`);
  }

  return Array.from(new Set(keywords.map(clean)));
}
