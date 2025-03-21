"use client"

import { motion } from "framer-motion"
import { CalendarIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const releases = [
  {
    version: "v2.4.0",
    date: "March 1, 2023",
    title: "Enhanced Action Item Detection",
    description:
      "Our AI now identifies action items with greater accuracy and can assign them to specific team members automatically based on context.",
    features: [
      "Improved action item detection algorithm",
      "Automatic assignee detection",
      "Due date suggestion based on conversation context",
      "Integration with more task management tools",
    ],
    tags: ["Feature", "AI Improvement"],
  },
  {
    version: "v2.3.0",
    date: "February 15, 2023",
    title: "Multi-language Support",
    description:
      "Descript AI now supports transcription and summarization in 12 languages, including Spanish, French, German, Japanese, and Chinese.",
    features: [
      "Added support for 12 languages",
      "Language auto-detection",
      "Cross-language summaries",
      "Improved accuracy for non-native speakers",
    ],
    tags: ["Feature", "Languages"],
  },
  {
    version: "v2.2.5",
    date: "February 1, 2023",
    title: "Performance Improvements",
    description: "This update focuses on speed and reliability improvements across the platform.",
    features: [
      "50% faster transcription processing",
      "Reduced latency for real-time transcription",
      "Improved error handling for unstable connections",
      "Better handling of overlapping speakers",
    ],
    tags: ["Performance", "Bug Fix"],
  },
  {
    version: "v2.2.0",
    date: "January 15, 2023",
    title: "Custom Summary Templates",
    description:
      "Create and save custom templates for meeting summaries to ensure consistency across your organization.",
    features: [
      "Custom summary templates",
      "Template sharing across teams",
      "Organization-specific terminology support",
      "Template analytics",
    ],
    tags: ["Feature", "Customization"],
  },
  {
    version: "v2.1.0",
    date: "January 1, 2023",
    title: "Advanced Analytics Dashboard",
    description: "Gain insights into your meeting patterns with our new analytics dashboard.",
    features: [
      "Meeting frequency and duration analytics",
      "Participation balance metrics",
      "Action item completion rates",
      "Team productivity trends",
    ],
    tags: ["Feature", "Analytics"],
  },
]

export default function ReleasesList() {
  return (
    <div className="py-24 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-extrabold text-foreground sm:text-5xl">Release Notes</h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Stay up to date with the latest improvements to Descript AI
          </p>
        </motion.div>

        <div className="space-y-16">
          {releases.map((release, index) => (
            <motion.div
              key={release.version}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground">
                    <CalendarIcon className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h2 className="text-2xl font-bold text-foreground">{release.title}</h2>
                  <div className="flex items-center mt-1 space-x-3">
                    <span className="text-sm font-medium text-primary">{release.version}</span>
                    <span className="text-sm text-muted-foreground">{release.date}</span>
                    <div className="flex space-x-2">
                      {release.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 ml-16">
                <p className="text-muted-foreground">{release.description}</p>
                <ul className="mt-4 space-y-2">
                  {release.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="ml-2 text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

