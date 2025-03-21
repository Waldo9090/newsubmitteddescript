"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For individuals just getting started",
    features: [
      "5 hours of transcription per month",
      "Basic summaries",
      "Action item extraction",
      "1 user only",
      "7-day history",
    ],
    cta: "Get started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$24.99",
    description: "For professionals and small teams",
    features: [
      "20 hours of transcription per month",
      "Advanced AI summaries",
      "Action item tracking",
      "Up to 5 team members",
      "30-day history",
      "Calendar integrations",
    ],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Yearly",
    price: "$99",
    description: "For growing teams and organizations",
    features: [
      "Unlimited transcription",
      "Custom AI training",
      "Advanced analytics",
      "Unlimited team members",
      "Unlimited history",
      "All integrations",
      "Priority support",
    ],
    cta: "Contact sales",
    popular: false,
  },
]

export default function PricingContent() {
  return (
    <div className="bg-background py-24 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary-light rounded-full"
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
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-secondary-light rounded-full"
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
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-extrabold text-foreground sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-xl text-muted-foreground">Choose the plan that's right for your team</p>
        </motion.div>
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`border rounded-lg shadow-sm divide-y divide-border ${
                plan.popular ? "border-primary ring-2 ring-primary" : "border-border"
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -15px rgba(0, 0, 0, 0.2)" }}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                  Most Popular
                </div>
              )}
              <div className="p-6">
                <h3 className="text-lg font-medium text-foreground">{plan.name}</h3>
                <p className="mt-4 text-3xl font-extrabold text-foreground">{plan.price}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.name === "Free" ? "Forever free" : "per user/month"}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                <Link href="/dashboard">
                  <Button className="mt-6 w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
              <div className="px-6 pt-6 pb-8">
                <h4 className="text-sm font-medium text-foreground tracking-wide uppercase">What's included</h4>
                <ul className="mt-6 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <div className="flex-shrink-0">
                        <Check className="h-6 w-6 text-primary" aria-hidden="true" />
                      </div>
                      <p className="ml-3 text-sm text-muted-foreground">{feature}</p>
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

