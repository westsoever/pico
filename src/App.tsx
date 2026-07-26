import './App.css'

const coffees = [
  {
    name: 'Ethiopia Yirgacheffe',
    roaster: 'Noma Coffee',
    origin: 'Ethiopia',
    notes: 'Jasmine, bergamot, lemon zest',
    rating: 4.6,
    reviews: 128,
  },
  {
    name: 'Colombia Huila',
    roaster: 'La Cabra',
    origin: 'Colombia',
    notes: 'Caramel, red apple, milk chocolate',
    rating: 4.4,
    reviews: 94,
  },
  {
    name: 'Kenya AA Nyeri',
    roaster: 'April Coffee',
    origin: 'Kenya',
    notes: 'Blackcurrant, tomato, brown sugar',
    rating: 4.7,
    reviews: 211,
  },
  {
    name: 'Guatemala Antigua',
    roaster: 'Onyx Coffee Lab',
    origin: 'Guatemala',
    notes: 'Dark chocolate, hazelnut, orange',
    rating: 4.5,
    reviews: 76,
  },
]

function App() {
  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Pico</p>
        <h1>Discover coffee like Vivino discovers wine.</h1>
        <p className="subtitle">
          Rate roasts, track tasting notes, and find your next favorite cup.
        </p>
      </header>

      <main className="grid">
        {coffees.map((coffee) => (
          <article key={coffee.name} className="card">
            <div className="card-top">
              <div>
                <h2>{coffee.name}</h2>
                <p className="roaster">{coffee.roaster}</p>
              </div>
              <div className="rating">
                <span>{coffee.rating.toFixed(1)}</span>
                <small>{coffee.reviews} reviews</small>
              </div>
            </div>
            <p className="origin">{coffee.origin}</p>
            <p className="notes">{coffee.notes}</p>
          </article>
        ))}
      </main>
    </div>
  )
}

export default App
