interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  bgColor?: string;
  iconBg?: string;
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  trendValue,
  bgColor = 'bg-blue-50',
  iconBg = 'bg-blue-100',
}: StatCardProps) {
  return (
    <div className={`${bgColor} rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition`}>
      {/* Header with icon */}
      <div className="flex items-start justify-between mb-4">
        <div className={`${iconBg} rounded-lg p-3 w-fit`}>
          {icon}
        </div>
        {trend && (
          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-green-100 text-green-700' :
            trend === 'down' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-gray-600 font-medium mb-2">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
