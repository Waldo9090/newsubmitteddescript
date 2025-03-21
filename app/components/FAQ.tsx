"use client"

import { motion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "How accurate is the transcription?",
    answer:
      "Descript AI uses state-of-the-art speech recognition technology that achieves over 95% accuracy in most environments. The accuracy improves over time as our AI learns from your team's vocabulary and speaking patterns.",
  },
  {
    question: "Which video conferencing platforms are supported?",
    answer:
      "Descript AI integrates with Zoom, Microsoft Teams, Google Meet and more. You can also upload recordings from other platforms or record directly within our app.",
  },
  {
    question: "How are action items tracked?",
    answer:
      "Our AI automatically identifies tasks and commitments made during meetings and assigns them to the relevant team members.",
  },
  {
    question: "Is my meeting data secure?",
    answer:
      "Yes, we take security seriously. You can also delete your meeting data at any time.",
  },
  {
    question: "Can I edit the transcripts and summaries?",
    answer:
      "While our AI is highly accurate, you can always edit transcripts, summaries, and action items to ensure they perfectly match your needs.",
  },
  {
    question: "How much does Descript AI cost?",
    answer:
      "Descript AI offers a free plan for individuals with limited features. Our paid plans start at $24.99/month per user for the Pro plan and $99/year per user for the Yearly plan. Enterprise pricing is available for larger organizations. Visit our Pricing page for more details.",
  },
]

export default function FAQ() {
  return (
    <div className="py-24 bg-secondary relative overflow-hidden" id="faq">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 -right-16 w-32 h-32 bg-primary-light rounded-full"
          animate={{
            y: [0, -20, 0],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -left-16 w-24 h-24 bg-secondary-light rounded-full"
          animate={{
            y: [0, 30, 0],
            x: [0, -30, 0],
          }}
          transition={{
            duration: 7,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">Frequently asked questions</h2>
          <p className="mt-4 text-xl text-muted-foreground">Everything you need to know about Descript AI</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-medium text-lg">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </div>
  )
}

