export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: 'hiring-in-ghana',
    title: "How to Hire Elite Tech Talent in Ghana: 2026 Guide",
    excerpt: "Accra's tech scene is exploding. Learn how to navigate the local landscape, salary benchmarks, and cultural nuances of hiring in the Gateway to Africa.",
    content: `
      ## The Rise of West African Tech
      Accra has become a critical hub for global engineering teams. Companies like Google and Microsoft have established significant presences, but the real power lies in the burgeoning freelance ecosystem.

      ## Competitive Salary Benchmarks
      In 2026, a Senior Full-Stack Engineer in Accra typically commands... (Full guide available in the Resource Center)
    `,
    author: "JobWahala Editorial",
    date: "April 2, 2026",
    readTime: "8 min read",
    category: "Hiring Guide",
    image: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: 'freelance-success-ghana',
    title: "Success Spotlight: From Kumasi to Global Contracts",
    excerpt: "Meet the freelancers defying boundaries. A deep dive into how Ghanaian professionals are leveraging JobWahala to secure high-paying international gigs.",
    content: `
      ## Innovation Beyond Accra
      While Accra gets the headlines, Kumasi's tech scene is growing rapidly. Our community member Kwame increased his revenue by 300% by...
    `,
    author: "Community Team",
    date: "March 28, 2026",
    readTime: "5 min read",
    category: "Success Stories",
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800",
  }
]
