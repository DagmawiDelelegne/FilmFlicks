"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/StatsCard";
import { Pie } from "react-chartjs-2";
import { useSession } from "next-auth/react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
  type Plugin,
} from "chart.js";
import { get_stats, get_genre_stats, get_streaming_stats } from "@/lib/api";
ChartJS.register(ArcElement, Tooltip, Legend);

interface Stats {
  liked: number;
  disliked: number;
}

interface GenreStats {
  [genre: string]: number;
}

interface StreamingStats {
  [service: string]: number;
}

export default function StatsPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [genres, setGenres] = useState<GenreStats>({});
  const [streaming, setStreaming] = useState<StreamingStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      setStats(null);
      setGenres({});
      setStreaming({});

      try {
        const [dataStats, dataGenres, dataStreaming] = await Promise.all([
          get_stats(),
          get_genre_stats(),
          get_streaming_stats(),
        ]);
        if (cancelled) return;

        const sortedGenres = Object.entries(dataGenres)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        setStats(dataStats);
        setGenres(Object.fromEntries(sortedGenres));
        setStreaming(dataStreaming);
      } catch (err) {
        if (!cancelled) console.error("Failed to load stats:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (status === "authenticated" && session?.user?.id) {
      fetchStats();
    } else if (status === "unauthenticated") {
      setStats(null);
      setGenres({});
      setStreaming({});
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  if (status === "loading" || loading)
    return <p className="p-6 text-white">Loading stats...</p>;

  if (!stats)
    return <p className="p-6 text-red-500">Failed to load stats</p>;

  const genreLabels = Object.keys(genres);
  const genreDataValues = Object.values(genres);
  const genreData: ChartData<"pie", number[], string> = {
    labels: genreLabels,
    datasets: [
      {
        data: genreDataValues,
        backgroundColor: [
          "#10B981",
          "#F59E0B",
          "#EF4444",
          "#3B82F6",
          "#8B5CF6",
        ],
      },
    ],
  };

  const sortedStreaming = Object.entries(streaming)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5);
  const streamingLabels = sortedStreaming.map(([key]) => key);
  const streamingValues = sortedStreaming.map(([, value]) => value);
  const streamingData: ChartData<"pie", number[], string> = {
    labels: streamingLabels,
    datasets: [
      {
        data: streamingValues,
        backgroundColor: [
          "#6366F1",
          "#EC4899",
          "#F59E0B",
          "#10B981",
          "#3B82F6",
        ],
      },
    ],
  };

  const plugins: Plugin<"pie">[] = [
    {
      id: "sliceLabels",
      afterDraw: (chart) => {
        const meta = chart.getDatasetMeta(0);
        const labels = chart.data.labels;

        if (!meta?.data || !labels) return;

        const ctx = chart.ctx;

        meta.data.forEach((arc, index) => {
          if (!(arc instanceof ArcElement)) return;
          const label = labels[index];
          if (!label) return;

          const midAngle = (arc.startAngle + arc.endAngle) / 2;
          const radius = arc.outerRadius * 0.65;
          const x = arc.x + radius * Math.cos(midAngle);
          const y = arc.y + radius * Math.sin(midAngle);

          ctx.save();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(label), x, y);
          ctx.restore();
        });
      },
    },
  ];

  const options: ChartOptions<"pie"> = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Your Stats</h1>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatsCard
          label="Liked Movies"
          count={stats.liked}
          color="bg-green-600"
        />
        <StatsCard
          label="Disliked Movies"
          count={stats.disliked}
          color="bg-red-600"
        />
      </div>

      {/* Charts */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-2">

        {/* Genres */}
        {genreLabels.length > 0 && (
          <div className="flex flex-col items-center">
            <Pie data={genreData} options={options} plugins={plugins} />
            <p className="mt-4 text-center font-semibold text-white">
              Your Top Genres
            </p>
          </div>
        )}

        {/* Streaming */}
        {streamingLabels.length > 0 && (
          <div className="flex flex-col items-center">
            <Pie data={streamingData} options={options} plugins={plugins} />
            <p className="mt-4 text-center font-semibold text-white">
              Your Top Streaming Services
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
