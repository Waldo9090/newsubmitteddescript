"use client"

import { Mic, FileText, CheckSquare, Share2, Calendar, Clock } from "lucide-react"
import { motion } from "framer-motion"

const features = [
  {
    name: "Accurate Recordings",
    description: "Precise speech-to-text with speaker identification.",
    icon: Mic,
  },
  {
    name: "Smart Summaries",
    description: "Concise meeting recaps capturing key decisions.",
    icon: FileText,
  },
  {
    name: "Action Item Tracking",
    description: "Automatically extract and assign tasks from conversations.",
    icon: CheckSquare,
  },
  {
    name: "Calendar Integration",
    description: "Connect with Google Calendar, Outlook, and more.",
    icon: Calendar,
  },
  {
    name: "Real-time Notes",
    description: "Get meeting notes instantly when your call ends.",
    icon: Clock,
  },
  {
    name: "Seamless Sharing",
    description: "Share notes with your team in one click.",
    icon: Share2,
  },
]

export default function Features() {
  return (
    <div className="py-24 bg-background relative overflow-hidden" id="features">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -right-1/4 w-1/2 h-1/2 bg-primary/10 dark:bg-primary/20 rounded-full"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 45, 0],
          }}
          transition={{
            duration: 15,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/4 w-1/2 h-1/2 bg-secondary/10 dark:bg-secondary/20 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -45, 0],
          }}
          transition={{
            duration: 20,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <motion.span
            className="inline-block text-primary font-semibold tracking-wide uppercase mb-2"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Features
          </motion.span>
          <motion.h2
            className="text-3xl leading-8 font-extrabold tracking-tight text-foreground sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Everything you need for better meetings
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.name}
              className="bg-card dark:bg-card/80 border border-border rounded-xl p-6 hover:shadow-lg transition-all"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -15px rgba(0, 0, 0, 0.2)" }}
            >
              <motion.div
                className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4"
                whileHover={{ scale: 1.05, backgroundColor: "var(--primary)" }}
                transition={{ duration: 0.2 }}
              >
                <feature.icon className="h-6 w-6 text-primary" />
              </motion.div>
              <h3 className="text-lg font-medium text-foreground mb-2">{feature.name}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

