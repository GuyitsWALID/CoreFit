// src/hooks/useOnboarding.ts
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface OnboardingData {
  gymName: string
  ownerName: string
  managerName: string
  email: string
  phone: string
  address: string
  latitude?: number
  longitude?: number
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logo?: string
  description: string
  amenities: string[]
}

export function useOnboarding() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onboardGym = async (data: OnboardingData) => {
    setIsLoading(true)
    setError(null)

    try {
      const {
        gymName,
        ownerName,
        managerName,
        email,
        phone,
        address,
        latitude,
        longitude,
        primaryColor,
        secondaryColor,
        accentColor,
        logo,
        description,
        amenities
      } = data

      // Validate required fields
      if (!gymName || !email || !ownerName) {
        throw new Error('Missing required fields')
      }

      // Generate unique slug
      const baseSlug = gymName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)

      let slug = baseSlug
      let counter = 1

      // Check if slug exists and make it unique
      while (true) {
        const { data: existingGym } = await supabase
          .from('gyms')
          .select('id')
          .eq('slug', slug)
          .single()

        if (!existingGym) break
        slug = `${baseSlug}-${counter}`
        counter++
      }

      // Insert gym data
      const { data: gym, error: gymError } = await supabase
        .from('gyms')
        .insert({
          name: gymName,
          slug,
          owner_name: ownerName,
          manager_name: managerName,
          email,
          phone,
          address,
          latitude: latitude || null,
          longitude: longitude || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          logo_url: logo || null,
          description,
          amenities: amenities || [],
          status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (gymError) {
        throw new Error('Failed to create gym')
      }

      return {
        success: true,
        gym,
        slug,
        url: `/${slug}`
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Internal server error'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    onboardGym,
    isLoading,
    error
  }
}