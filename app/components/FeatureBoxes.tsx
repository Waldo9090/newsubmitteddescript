"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function FeatureBoxes() {
  return (
    <div className="py-24 bg-secondary/30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <motion.h2
            className="text-3xl font-extrabold text-foreground sm:text-4xl mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Maximize the value of every meeting
          </motion.h2>
          <motion.p
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Simple tools to make your meetings more productive
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Feature Box 1 */}
          <motion.div
            className="bg-background rounded-2xl overflow-hidden shadow-md border border-border"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, boxShadow: "0 20px 40px -20px rgba(0, 0, 0, 0.2)" }}
          >
            <div className="p-8 flex flex-col h-full">
              <h3 className="text-xl font-bold text-foreground mb-4">Meticulous notes</h3>
              <p className="text-muted-foreground mb-6">Notes perfectionists would be proud of.</p>
              <div className="mt-auto">
                <Link href="/dashboard">
                  <Button className="w-full">Start for free</Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Feature Box 2 */}
          <motion.div
            className="bg-primary rounded-2xl overflow-hidden shadow-md"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, boxShadow: "0 20px 40px -20px rgba(0, 0, 0, 0.3)" }}
          >
            <div className="p-8 h-full flex flex-col">
              <div className="bg-white/10 rounded-xl p-6 mb-6">
                <div className="text-white font-medium mb-2">Get Pro Access</div>
                <div className="text-white/80 text-sm mb-4">Unlock all features</div>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <span className="text-white/90 mr-2">•</span>
                    <p className="text-white/90 text-sm">Unlimited AI note-taking minutes</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-white/90 mr-2">•</span>
                    <p className="text-white/90 text-sm">Chat with notes, audio, and videos</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-white/90 mr-2">•</span>
                    <p className="text-white/90 text-sm">Convert recordings, YouTube videos, and files into AI notes</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-white/90 mr-2">•</span>
                    <p className="text-white/90 text-sm">Cutting edge AI transcription models</p>
                  </div>
                </div>
              </div>
              <div className="mt-auto">
                <Link href="/dashboard">
                  <Button variant="secondary" className="w-full">
                    Start for free
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Feature Box 3 */}
          <motion.div
            className="bg-background rounded-2xl overflow-hidden shadow-md border border-border"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, boxShadow: "0 20px 40px -20px rgba(0, 0, 0, 0.2)" }}
          >
            <div className="p-8 flex flex-col h-full">
              <h3 className="text-xl font-bold text-foreground mb-4">Actionable insights</h3>
              <p className="text-muted-foreground mb-6">Never miss a follow-up.</p>
              <div className="mt-auto">
                <Link href="/dashboard">
                  <Button className="w-full">Start for free</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

