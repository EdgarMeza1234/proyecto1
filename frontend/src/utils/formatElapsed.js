export function formatElapsed(from, to) {
  if (!from || !to) return ''
  const diff = new Date(to) - new Date(from)
  if (diff < 0) return ''
  const totalMinutes = Math.floor(diff / 60000)
  if (totalMinutes < 1) return '< 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (days > 0) {
    return `${days}d ${remainingHours}h`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }
  return `${minutes}min`
}
