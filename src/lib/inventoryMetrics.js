const number = (value) => Number(value) || 0;

export const inventoryQuantity = (item) => number(item?.stock ?? item?.quantity ?? item?.qty);
export const inventoryThreshold = (item) => number(item?.lowStockAt ?? item?.lowStockThreshold ?? item?.minStock ?? item?.minimumStock ?? 5);
export const isLowStock = (item) => inventoryQuantity(item) <= inventoryThreshold(item);

export function inventoryMetrics(items = []) {
  const lowStock = items.filter(isLowStock);
  const totalItems = items.reduce((sum, item) => sum + inventoryQuantity(item), 0);
  const totalStockValue = items.reduce((sum, item) => sum + inventoryQuantity(item) * number(item.buyPrice ?? item.costPrice), 0);
  const totalSellValue = items.reduce((sum, item) => sum + inventoryQuantity(item) * number(item.sellPrice ?? item.salePrice), 0);
  const soldProfit = items.reduce((total, item) => total + (item.movements || [])
    .filter((movement) => movement.type === 'out')
    .reduce((sum, movement) => sum + (number(movement.price) - number(item.buyPrice ?? item.costPrice)) * (number(movement.qty) || 1), 0), 0);
  const totalPurchased = items.reduce((total, item) => total + (item.movements || [])
    .filter((movement) => movement.type === 'in')
    .reduce((sum, movement) => sum + number(movement.price ?? item.buyPrice) * (number(movement.qty) || 1), 0), 0);
  const totalSold = items.reduce((total, item) => total + (item.movements || [])
    .filter((movement) => movement.type === 'out')
    .reduce((sum, movement) => sum + number(movement.price ?? item.sellPrice) * (number(movement.qty) || 1), 0), 0);
  return { skuCount: items.length, totalItems, lowStock, totalStockValue, totalSellValue, totalPurchased, totalSold, potentialProfit: totalSellValue - totalStockValue, soldProfit };
}
