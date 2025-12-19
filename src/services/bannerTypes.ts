export type Banner = {
	id: number
	name: string
	banner_type: number
	banner_tag: number
	start_date: string
	end_date: string
	image: string | null
	admin_comments: string | null
}

export type BannerContextType = {
	banners: Banner[] | null
	setBanners: (banners: Banner[] | null) => void
}