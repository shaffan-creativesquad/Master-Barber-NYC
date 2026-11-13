import { getMemberships } from '@/lib/site-data'
import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  firstName?: string
  planName?: string
  amount?: string
  dueDate?: string
  billingDay?: string
  signInUrl?: string
}

const Email = ({
  firstName,
  planName = 'membership',
  amount = '',
  dueDate = '',
  billingDay = '10th',
  signInUrl = 'https://masterbarbernyc.com/account',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Add your card to keep your Master Barber NYC membership active.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MASTER BARBER NYC</Text>
        <Heading style={heading}>Set up your membership billing</Heading>
        <Text style={text}>
          {firstName ? `Hi ${firstName},` : 'Hi there,'} we&apos;ve moved memberships to a new
          system. To keep your <strong>{planName}</strong> running without interruption, please add
          your card once — it takes about a minute.
        </Text>
        {amount || dueDate ? (
          <Section style={card}>
            {amount ? <Text style={cardLine}>Plan: {planName} — {amount}</Text> : null}
            {dueDate ? <Text style={cardLine}>Next payment due: {dueDate}</Text> : null}
            <Text style={cardLine}>Billing runs on the {billingDay} of each month.</Text>
          </Section>
        ) : null}

        <Section style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <Button style={button} href={signInUrl}>
            Add My Card
          </Button>
        </Section>
        <Text style={muted}>
          This link signs you in automatically — no password needed. It expires in 24 hours; you can
          always request a new one at masterbarbernyc.com.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Questions? Just reply to this email and our team will help.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Action needed: add your card to keep your membership active',
  displayName: 'Billing setup invite',
  get previewData() {
    return {
    firstName: 'Cody',
    planName: 'Silver Unlimited',
    amount: `${getMemberships().find((m) => m.id === 'silver-monthly')?.price ?? ''}/mo`,
    dueDate: 'September 10, 2026',
    signInUrl: 'https://masterbarbernyc.com/account',
    }
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Helvetica, Arial, sans-serif',
  color: '#1a1a1a',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '12px',
  letterSpacing: '3px',
  color: '#8a6d1f',
  margin: '0 0 12px',
  fontWeight: 700,
}
const heading = { fontSize: '24px', margin: '0 0 12px', color: '#111111' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#333333', margin: '0 0 20px' }
const card = {
  border: '1px solid #e8e2d3',
  borderRadius: '14px',
  padding: '16px 20px',
  backgroundColor: '#fdfaf3',
  margin: '0 0 24px',
}
const cardLine = { fontSize: '14px', color: '#333333', margin: '4px 0' }
const button = {
  backgroundColor: '#c9a84c',
  color: '#1a1a1a',
  fontWeight: 700,
  fontSize: '15px',
  padding: '13px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
}
const muted = {
  fontSize: '13px',
  color: '#6b6b6b',
  textAlign: 'center' as const,
  margin: '14px 0 0',
}
const hr = { borderColor: '#eeeeee', margin: '26px 0 16px' }
const footer = { fontSize: '13px', color: '#6b6b6b', margin: 0 }
