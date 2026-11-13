import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  firstName?: string
  service?: string
  price?: string
  barber?: string
  when?: string
  location?: string
  address?: string
  status?: string
  reference?: string
}

const Email = ({ firstName, service = '', price = '', barber = '', when = '', location = '', address = '', status = 'confirmed', reference = '' }: Props) => {
  const pending = status === 'pending'
  const rows: Array<[string, string]> = [
    ['Service', price ? `${service} · ${price}` : service],
    ['Barber', barber],
    ['Date & time', when],
    ['Location', address ? `${location}, ${address}` : location],
    ['Appointment #', reference],
  ]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{pending ? 'We received your booking request' : 'Your appointment is confirmed'} at Master Barber NYC</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>MASTER BARBER NYC</Text>
          <Heading style={heading}>{pending ? 'Booking request received' : "You're all set"}</Heading>
          <Text style={text}>
            {firstName ? `Hi ${firstName},` : 'Hi there,'}{' '}
            {pending ? "we received your request and will confirm your time within one business day." : 'your appointment is confirmed. Here are the details.'}
          </Text>
          <Section style={card}>
            {rows.filter(([, v]) => v).map(([l, v]) => (
              <Row key={l} style={row}>
                <Column style={label}>{l}</Column>
                <Column style={value}>{v}</Column>
              </Row>
            ))}
          </Section>
          <Text style={text}>Need to change or cancel? Please call the shop at least 24 hours ahead.</Text>
          <Hr style={hr} />
          <Text style={footer}>Questions? Just reply to this email and our team will help.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d['status'] === 'pending' ? 'Your booking request at Master Barber NYC' : 'Your Master Barber NYC appointment is confirmed',
  displayName: 'Booking confirmation (customer)',
  previewData: { firstName: 'Cody', service: 'Haircut', price: '$45', barber: 'Angelo', when: 'Friday, October 2 at 2:30 PM', location: 'Downtown Brooklyn', address: '66 Bond Street', status: 'confirmed', reference: 'A1B2C3' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '12px', letterSpacing: '3px', color: '#8a6d1f', margin: '0 0 12px', fontWeight: 700 }
const heading = { fontSize: '24px', margin: '0 0 12px', color: '#111111' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#333333', margin: '0 0 20px' }
const card = { border: '1px solid #e8e2d3', borderRadius: '14px', padding: '18px 20px', backgroundColor: '#fdfaf3', margin: '0 0 24px' }
const row = { padding: '6px 0' }
const label = { fontSize: '13px', color: '#6b6b6b', width: '40%' }
const value = { fontSize: '14px', color: '#111111', fontWeight: 600, textAlign: 'right' as const }
const hr = { borderColor: '#eeeeee', margin: '26px 0 16px' }
const footer = { fontSize: '13px', color: '#6b6b6b', margin: 0 }
