import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Row, Column, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  kind?: 'booking' | 'membership'
  title?: string
  details?: Array<{ label: string; value: string }>
}

const Email = ({ title = 'New order on the website', details = [] }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MASTER BARBER NYC · SHOP ALERT</Text>
        <Heading style={heading}>{title}</Heading>
        <Section style={card}>
          {details.filter((d) => d.value).map((d) => (
            <Row key={d.label} style={row}>
              <Column style={label}>{d.label}</Column>
              <Column style={value}>{d.value}</Column>
            </Row>
          ))}
        </Section>
        <Text style={footer}>Full details are in the admin dashboard.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d['title'] ?? 'New order on the website',
  displayName: 'Shop alert (new booking / membership)',
  to: 'masterclassbarbernyc@gmail.com',
  previewData: {
    kind: 'booking',
    title: 'New booking: Cody Smith — Fri, Oct 2 at 2:30 PM',
    details: [
      { label: 'Customer', value: 'Cody Smith' },
      { label: 'Phone', value: '(555) 123-4567' },
      { label: 'Service', value: 'Haircut · $45' },
      { label: 'Barber', value: 'Angelo' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '12px', letterSpacing: '3px', color: '#8a6d1f', margin: '0 0 12px', fontWeight: 700 }
const heading = { fontSize: '22px', margin: '0 0 16px', color: '#111111' }
const card = { border: '1px solid #e8e2d3', borderRadius: '14px', padding: '18px 20px', backgroundColor: '#fdfaf3', margin: '0 0 20px' }
const row = { padding: '6px 0' }
const label = { fontSize: '13px', color: '#6b6b6b', width: '40%' }
const value = { fontSize: '14px', color: '#111111', fontWeight: 600, textAlign: 'right' as const }
const footer = { fontSize: '13px', color: '#6b6b6b', margin: 0 }
