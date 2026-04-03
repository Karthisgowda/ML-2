export default function Logo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SmartDesk"
    >
      {/* Outer ring */}
      <circle cx="14" cy="14" r="11" stroke="#60a5fa" strokeWidth="3.5" fill="none" />
      {/* Inner dot */}
      <circle cx="14" cy="14" r="3.5" fill="#818cf8" />
    </svg>
  )
}
