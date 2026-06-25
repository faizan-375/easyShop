import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  Globe2,
  History,
  Loader2,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Trophy,
  XCircle,
  Zap
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { createSearch, getHistory, getProduct, getResults, rerunAnalysis } from "./lib/api.js";

const LOGO_ICON = "/assets/easyshop-logo-icon.png";
const DEFAULT_MARKET_LOCATION = "Pakistan";

const statusSteps = [
  { id: "queued", label: "Queued" },
  { id: "searching", label: "Searching" },
  { id: "extracting", label: "Extracting" },
  { id: "analyzing", label: "Analyzing" },
  { id: "completed", label: "Completed" }
];

const dashboardTabs = [
  { id: "search", label: "Search", icon: Search },
  { id: "websites", label: "Websites", icon: Globe2 },
  { id: "results", label: "Results", icon: ShoppingBag },
  { id: "deals", label: "Deals", icon: Trophy },
  { id: "prices", label: "Prices", icon: BarChart3 },
  { id: "detail", label: "Detail", icon: PackageSearch },
  { id: "history", label: "History", icon: History }
];

const supportedPlatforms = [
  { name: "Daraz", type: "Marketplace", tone: "orange", domain: "daraz.pk" },
  { name: "PriceOye", type: "Mobiles", tone: "blue", domain: "priceoye.pk" },
  { name: "Telemart", type: "Electronics", tone: "green", domain: "telemart.pk" },
  { name: "Shophive", type: "Tech", tone: "purple", domain: "shophive.com" },
  { name: "Mega.pk", type: "Computers", tone: "yellow", domain: "mega.pk" },
  { name: "HomeShopping", type: "Retail", tone: "pink", domain: "homeshopping.pk" },
  { name: "iShopping", type: "Deals", tone: "cyan", domain: "ishopping.pk" },
  { name: "Symbios", type: "Gadgets", tone: "orange", domain: "symbios.pk" },
  { name: "Paklap", type: "Laptops", tone: "blue", domain: "paklap.pk" },
  { name: "OLX", type: "Local finds", tone: "green", domain: "olx.com.pk" },
  { name: "AliExpress", type: "Global", tone: "yellow", domain: "aliexpress.com" },
  { name: "Amazon", type: "Global", tone: "purple", domain: "amazon.com" }
];

const searchHints = [
  "Search for best deals...",
  "Looking for lowest prices?",
  "Compare products instantly...",
  "Find better offers today..."
];

const customerReviews = [
  {
    name: "Ayesha K.",
    role: "Student shopper",
    text: "Easy Shop makes price checking feel simple. I can compare options quickly and avoid overpaying for electronics.",
    rating: 4
  },
  {
    name: "Bilal A.",
    role: "Mobile buyer",
    text: "The deal ranking is exactly what I needed. It shows the better option without making me open every store manually.",
    rating: 5
  },
  {
    name: "Hina S.",
    role: "Home shopper",
    text: "I like how clean the dashboard is. Prices, websites, and recommendations are all in one place.",
    rating: 5
  },
  {
    name: "Usman R.",
    role: "Tech finder",
    text: "Searching across supported stores saves a lot of time. The best deal view is my favorite part.",
    rating: 4
  },
  {
    name: "Maham T.",
    role: "Budget buyer",
    text: "The app feels fast, polished, and useful. It helps me choose with more confidence before buying.",
    rating: 5
  },
  {
    name: "Zain M.",
    role: "Laptop shopper",
    text: "Easy Shop turns confusing product pages into a clear comparison. It is perfect for finding better value.",
    rating: 4
  },
  {
    name: "Sara N.",
    role: "Deal hunter",
    text: "The supported platform list and product scoring make the shopping process feel much more organized.",
    rating: 5
  },
  {
    name: "Hamza I.",
    role: "Online buyer",
    text: "I can search once and see useful results instead of jumping between websites. Very helpful concept.",
    rating: 5
  }
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function money(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}

function statusLabel(status) {
  if (!status) return "Ready";
  return status.replace("-", " ");
}

function statusTone(status) {
  if (status === "completed") return "good";
  if (status === "failed") return "danger";
  if (status === "queued") return "warm";
  if (status) return "info";
  return "neutral";
}

function initials(name) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function logoUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function LogoLockup({ compact = false }) {
  return (
    <div className={cx("logo-lockup", compact && "logo-lockup-compact")}>
      <img src={LOGO_ICON} alt="Easy Shop logo" />
      <span>easyShop</span>
    </div>
  );
}

function CourierRider() {
  return (
    <div className="courier-track" aria-hidden="true">
      <div className="courier-rider">
        <span className="speed-line speed-line-one" />
        <span className="speed-line speed-line-two" />
        <div className="rider-head" />
        <div className="rider-body" />
        <div className="delivery-box" />
        <div className="motor-body" />
        <div className="motor-seat" />
        <div className="motor-handle" />
        <div className="wheel wheel-front" />
        <div className="wheel wheel-back" />
      </div>
    </div>
  );
}

function HeroGeometricBackground() {
  const shapes = [
    { className: "hero-shape-one", tone: "blue", delay: "0.3s" },
    { className: "hero-shape-two", tone: "orange", delay: "0.5s" },
    { className: "hero-shape-three", tone: "purple", delay: "0.4s" },
    { className: "hero-shape-four", tone: "amber", delay: "0.6s" },
    { className: "hero-shape-five", tone: "cyan", delay: "0.7s" }
  ];

  return (
    <div className="hero-geometric-bg" aria-hidden="true">
      <span className="hero-ambient hero-ambient-one" />
      <span className="hero-ambient hero-ambient-two" />
      {shapes.map((shape) => (
        <span
          key={shape.className}
          className={cx("hero-shape", shape.className, `hero-shape-${shape.tone}`)}
          style={{ "--shape-delay": shape.delay }}
        />
      ))}
    </div>
  );
}

function LiquidGlassFilter() {
  return (
    <svg className="liquid-glass-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter id="container-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

function ProductImage({ src, alt, compact = false }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cx("image-fallback", compact && "image-fallback-compact")}>
        <PackageSearch />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={cx("product-image", src.startsWith("/assets/") && "product-image-brand")}
    />
  );
}

function StatusPill({ status, children }) {
  return <span className={cx("status-pill", `status-${statusTone(status)}`)}>{children || statusLabel(status)}</span>;
}

function MetricTile({ label, value, icon: Icon, tone = "blue" }) {
  return (
    <div className="metric-tile">
      <span className={cx("metric-icon", `metric-${tone}`)}>
        <Icon size={20} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ariaLabel,
  ariaLive = "off",
  ariaRole = "marquee",
  ...props
}) {
  const marqueeRef = useRef(null);

  const copies = useMemo(
    () =>
      Array.from({ length: repeat }, (_, index) => (
        <div
          key={index}
          className={cx(
            "marquee-track",
            vertical ? "marquee-track-vertical" : "marquee-track-horizontal",
            pauseOnHover && "marquee-track-pause",
            reverse && "marquee-track-reverse"
          )}
        >
          {children}
        </div>
      )),
    [children, pauseOnHover, repeat, reverse, vertical]
  );

  return (
    <div
      {...props}
      ref={marqueeRef}
      data-slot="marquee"
      className={cx("marquee-shell", vertical && "marquee-shell-vertical", className)}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      role={ariaRole}
      tabIndex={0}
    >
      {copies}
    </div>
  );
}

function HeroSearch({ form, setForm, onSubmit, loading }) {
  const [hintIndex, setHintIndex] = useState(0);
  const hasQuery = form.productName.trim().length > 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHintIndex((current) => (current + 1) % searchHints.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <form className="hero-search" onSubmit={onSubmit}>
      <label className="search-field">
        <Search size={22} aria-hidden="true" />
        <span className="sr-only">Product name</span>
        {!form.productName ? (
          <span key={searchHints[hintIndex]} className="search-hint">
            {searchHints[hintIndex]}
          </span>
        ) : null}
        <input
          value={form.productName}
          onChange={(event) => setForm((current) => ({ ...current, productName: event.target.value }))}
          placeholder=""
          required
        />
      </label>
      <button
        type="submit"
        className={cx("hero-search-button liquid-glass-button liquid-glass-search", hasQuery && "is-ready")}
        disabled={loading || !hasQuery}
      >
        <span>Search</span>
        {loading ? <Loader2 className="spin" size={19} /> : <Search size={22} />}
      </button>
    </form>
  );
}

function HeroSection({ form, setForm, onSubmit, loading }) {
  return (
    <section className="hero-section" id="top">
      <HeroGeometricBackground />
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="slogan-stage">
            <CourierRider />
            <h1>
              Har Product Ka <span>Best Deal Finder.</span>
            </h1>
          </div>
          <HeroSearch form={form} setForm={setForm} onSubmit={onSubmit} loading={loading} />
        </div>
      </div>
    </section>
  );
}

function Topbar() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsCompact(window.scrollY > 20);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={cx("topbar", isCompact && "topbar-compact")} aria-label="Primary navigation">
      <LogoLockup />
      <div className="topbar-links">
        <a className="liquid-glass-button liquid-glass-nav" href="#platforms">Platforms</a>
        <a className="liquid-glass-button liquid-glass-nav" href="#top">Dashboard</a>
        <a className="liquid-glass-button liquid-glass-nav" href="#contact">Contact</a>
      </div>
    </nav>
  );
}

function PlatformLogo({ platform }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={cx("platform-mark", `platform-${platform.tone}`)}>
      {!failed ? (
        <img src={logoUrl(platform.domain)} alt={`${platform.name} logo`} onError={() => setFailed(true)} />
      ) : (
        initials(platform.name)
      )}
    </span>
  );
}

function PlatformCard({ platform }) {
  return (
    <div className="platform-card">
      <PlatformLogo platform={platform} />
      <strong>{platform.name}</strong>
      <small>{platform.type}</small>
    </div>
  );
}

function PlatformShowcase() {
  const loop = [...supportedPlatforms, ...supportedPlatforms];

  return (
    <section className="section-block platforms-section" id="platforms">
      <div className="platform-heading">
        <span />
        <h2>Platforms we support</h2>
      </div>
      <div className="platform-marquee" aria-label="Supported apps slideshow">
        <div className="platform-track">
          {loop.map((platform, index) => (
            <PlatformCard key={`${platform.name}-${index}`} platform={platform} />
          ))}
        </div>
      </div>
      <div className="platform-marquee platform-marquee-reverse" aria-label="More supported apps slideshow">
        <div className="platform-track">
          {loop
            .slice()
            .reverse()
            .map((platform, index) => (
              <PlatformCard key={`${platform.name}-reverse-${index}`} platform={platform} />
            ))}
        </div>
      </div>
    </section>
  );
}

function DataOverview({ search, websites, products, summary, refreshing, searchId, onRefresh, onReanalyze }) {
  const pricedCount = products.filter((product) => Number.isFinite(product.normalizedPrice)).length;

  return (
    <div className="data-overview">
      <MetricTile label="Status" value={statusLabel(search?.status)} icon={Activity} tone="blue" />
      <MetricTile label="Websites" value={websites.length || 0} icon={Store} tone="green" />
      <MetricTile label="Priced products" value={`${pricedCount}/${products.length || 0}`} icon={Gauge} tone="orange" />
      <MetricTile label="Cheapest" value={money(summary?.minPrice ?? search?.stats?.cheapestPrice)} icon={Trophy} tone="purple" />
      <div className="overview-actions">
        <button type="button" className="icon-button" onClick={onRefresh} disabled={!searchId || refreshing} aria-label="Refresh results">
          <RefreshCcw className={cx(refreshing && "spin")} size={18} />
        </button>
        <button type="button" className="secondary-button" onClick={onReanalyze} disabled={!searchId || refreshing || !products.length}>
          <Zap size={17} />
          Analyze
        </button>
      </div>
    </div>
  );
}

function DashboardTabs({ active, setActive, counts }) {
  return (
    <div className="dashboard-tabs" role="tablist" aria-label="Easy Shop dashboard views">
      {dashboardTabs.map((tab) => {
        const Icon = tab.icon;
        const count = counts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={cx(active === tab.id && "active")}
            onClick={() => setActive(tab.id)}
          >
            <Icon size={17} />
            <span>{tab.label}</span>
            {count ? <em>{count}</em> : null}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ icon: Icon = PackageSearch, title, body }) {
  return (
    <div className="empty-state">
      <Icon size={42} />
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function StatusTimeline({ search }) {
  const currentIndex = statusSteps.findIndex((step) => step.id === search?.status);
  const failed = search?.status === "failed";

  return (
    <div className="status-panel">
      <div className="panel-title-row">
        <div>
          <span>Deal scan</span>
          <h3>{search ? search.productName : "Ready for your first search"}</h3>
        </div>
        <StatusPill status={search?.status}>
          {failed ? "Failed" : search?.status === "completed" ? "Completed" : statusLabel(search?.status)}
        </StatusPill>
      </div>
      <DealScanLoader progress={search?.progress || 0} status={search?.status} />
      <div className="timeline-grid">
        {statusSteps.map((step, index) => {
          const done = search?.status === "completed" || index <= currentIndex;
          return (
            <div key={step.id} className={cx("timeline-step", done && "done")}>
              {done ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
      {search?.generatedKeywords?.length ? (
        <div className="keyword-row">
          {search.generatedKeywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      ) : null}
      {search?.error ? (
        <div className="alert-message">
          <XCircle size={17} />
          {search.error}
        </div>
      ) : null}
    </div>
  );
}

function DealScanLoader({ progress = 0, status }) {
  const active = status && status !== "completed" && status !== "failed";

  return (
    <div className={cx("deal-scan-loader", active && "is-active")}>
      <div className="scan-stage" aria-hidden="true">
        <span className="scan-wave scan-wave-one" />
        <span className="scan-wave scan-wave-two" />
        <span className="floating-tag tag-one">SALE</span>
        <span className="floating-tag tag-two">PKR</span>
        <span className="floating-tag tag-three">BEST</span>
        <div className="deal-scout">
          <span className="scout-head" />
          <span className="scout-body" />
          <span className="scout-arm" />
          <span className="scout-bag" />
          <span className="scout-leg scout-leg-one" />
          <span className="scout-leg scout-leg-two" />
        </div>
        <div className="scan-basket">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="progress-track fancy-progress" aria-label={`Deal scan progress ${Math.round(progress)} percent`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="scan-caption">
        <strong>{status === "completed" ? "Best deals ranked" : status === "failed" ? "Scan needs attention" : "Scanning stores for the best deal"}</strong>
        <small>{Math.round(progress)}% complete</small>
      </div>
    </div>
  );
}

function SearchView({ search }) {
  return (
    <div className="search-view">
      <StatusTimeline search={search} />
    </div>
  );
}

function WebsitesTable({ websites }) {
  if (!websites.length) {
    return <EmptyState icon={Globe2} title="No websites yet" body="Start a search to collect supported shopping pages." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Website</th>
            <th>Keyword</th>
            <th>Source</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {websites.map((website) => (
            <tr key={website.id || website.url}>
              <td>{website.rank || "-"}</td>
              <td>
                <strong>{website.title}</strong>
                <small>{website.url}</small>
              </td>
              <td>{website.keyword}</td>
              <td>{website.source}</td>
              <td>
                <button type="button" className="icon-button" onClick={() => window.open(website.url, "_blank", "noreferrer")} aria-label={`Open ${website.title}`}>
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ children }) {
  const tone =
    children === "Risky Deal" || children === "Risky/Incomplete Listing"
      ? "badge-danger"
      : children === "Lowest Price"
        ? "badge-warm"
        : "badge-good";
  return <span className={cx("badge", tone)}>{children}</span>;
}

function ScoreBar({ label, value, tone = "green" }) {
  return (
    <div className="score-bar">
      <span>
        <small>{label}</small>
        <small>{Math.round(value || 0)}</small>
      </span>
      <div>
        <i className={`score-${tone}`} style={{ width: `${Math.min(100, value || 0)}%` }} />
      </div>
    </div>
  );
}

function ProductCard({ product, onDetails }) {
  return (
    <article className="product-card">
      <div className="product-media">
        <ProductImage src={product.image} alt={product.title} compact />
      </div>
      <div className="product-content">
        <div className="badge-row">
          {(product.badges || []).slice(0, 3).map((badge) => (
            <Badge key={badge}>{badge}</Badge>
          ))}
        </div>
        <h3>{product.title}</h3>
        <div className="price-row">
          <strong>{product.price || money(product.normalizedPrice)}</strong>
          <span>
            <Star size={16} />
            {product.rating || "-"}
          </span>
        </div>
        <p className="store-name">{product.storeName}</p>
        <ScoreBar label="Quality" value={product.qualityScore} />
        <ScoreBar label="Trust" value={product.trustScore} tone="orange" />
        <p className="recommendation">{product.aiRecommendation}</p>
        <div className="card-actions">
          <button type="button" className="secondary-button" onClick={() => onDetails(product)}>
            <PackageSearch size={16} />
            Details
          </button>
          <button type="button" className="primary-button" onClick={() => window.open(product.productUrl, "_blank", "noreferrer")}>
            <ArrowUpRight size={16} />
            Store
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductResults({ products, onDetails }) {
  if (!products.length) {
    return <EmptyState icon={ShoppingBag} title="No products yet" body="Products appear after extraction and AI analysis complete." />;
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id || product.productUrl} product={product} onDetails={onDetails} />
      ))}
    </div>
  );
}

function DealTile({ title, product, icon: Icon }) {
  if (!product) {
    return (
      <div className="deal-tile">
        <Icon size={20} />
        <strong>{title}</strong>
        <span>No deal selected yet.</span>
      </div>
    );
  }

  return (
    <div className="deal-tile">
      <Icon size={20} />
      <strong>{title}</strong>
      <h3>{product.title}</h3>
      <p>{product.price || money(product.normalizedPrice)}</p>
      <span>{product.storeName}</span>
    </div>
  );
}

function BestDeals({ summary }) {
  return (
    <div className="deals-view">
      <div className="deal-grid">
        <DealTile title="Best Overall" product={summary?.bestOverall} icon={Trophy} />
        <DealTile title="Lowest Price" product={summary?.lowestPrice} icon={Gauge} />
        <DealTile title="Best Quality" product={summary?.bestQuality} icon={ShieldCheck} />
        <DealTile title="Trusted Store" product={summary?.trustedStore} icon={Store} />
      </div>
      {summary?.cheapestProducts?.length ? (
        <div className="cheapest-list">
          {summary.cheapestProducts.slice(0, 6).map((product, index) => (
            <div key={product.id || product.productUrl}>
              <span>{index + 1}</span>
              <strong>{product.title}</strong>
              <em>{product.storeName}</em>
              <b>{product.price || money(product.normalizedPrice)}</b>
              <button type="button" className="icon-button" onClick={() => window.open(product.productUrl, "_blank", "noreferrer")} aria-label={`Open ${product.title}`}>
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PriceComparison({ products }) {
  const chartData = useMemo(
    () =>
      products
        .filter((product) => Number.isFinite(product.normalizedPrice))
        .map((product) => ({
          name: product.storeName,
          price: product.normalizedPrice,
          score: product.overallScore
        })),
    [products]
  );

  if (!chartData.length) {
    return <EmptyState icon={BarChart3} title="No price data" body="Normalized prices appear here when product pages include prices." />;
  }

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ left: 4, right: 18, top: 18, bottom: 54 }}>
          <CartesianGrid stroke="#d9e2ef" vertical={false} />
          <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} interval={0} angle={-22} textAnchor="end" height={78} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} tickFormatter={money} width={94} />
          <Tooltip
            cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <strong>{payload[0].payload.name}</strong>
                  <span>{money(payload[0].value)}</span>
                  <small>Score {payload[0].payload.score || 0}</small>
                </div>
              ) : null
            }
          />
          <Bar dataKey="price" fill="#2563eb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProductDetail({ product }) {
  if (!product) {
    return <EmptyState icon={PackageSearch} title="No product selected" body="Open any product card to inspect full AI analysis and store signals." />;
  }

  return (
    <div className="detail-view">
      <div className="detail-media">
        <ProductImage src={product.image} alt={product.title} />
      </div>
      <div className="detail-content">
        <div className="badge-row">
          {(product.badges || []).map((badge) => (
            <Badge key={badge}>{badge}</Badge>
          ))}
        </div>
        <h3>{product.title}</h3>
        <strong className="detail-price">{product.price || money(product.normalizedPrice)}</strong>
        <p>{product.aiRecommendation}</p>
        <div className="detail-scores">
          <ScoreBar label="Quality" value={product.qualityScore} />
          <ScoreBar label="Trust" value={product.trustScore} tone="orange" />
          <ScoreBar label="Overall" value={product.overallScore} />
          <ScoreBar label="Confidence" value={product.confidenceScore} />
        </div>
        <dl className="detail-facts">
          <div>
            <dt>Store</dt>
            <dd>{product.storeName}</dd>
          </div>
          <div>
            <dt>Rating</dt>
            <dd>
              {product.rating || "-"} ({product.reviewsCount || 0} reviews)
            </dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{product.availability || "Unknown"}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{product.shipping || "Unknown"}</dd>
          </div>
        </dl>
        <button type="button" className="primary-button" onClick={() => window.open(product.productUrl, "_blank", "noreferrer")}>
          <ArrowUpRight size={17} />
          Visit Store
        </button>
      </div>
    </div>
  );
}

function HistoryPanel({ historyItems, onOpen }) {
  if (!historyItems.length) {
    return <EmptyState icon={History} title="No search history" body="Completed and in-progress searches are stored here." />;
  }

  return (
    <div className="history-list">
      {historyItems.map((item) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.id)}>
          <span>
            <strong>{item.productName}</strong>
            <small>{statusLabel(item.status)}</small>
          </span>
          <StatusPill status={item.status}>{item.status}</StatusPill>
          <ArrowUpRight size={16} />
        </button>
      ))}
    </div>
  );
}

function DashboardSection({
  active,
  setActive,
  counts,
  search,
  websites,
  products,
  summary,
  selectedProduct,
  historyItems,
  onDetails,
  onOpenHistory,
  error,
  refreshing,
  searchId,
  onRefresh,
  onReanalyze,
  lastUpdated
}) {
  const activeView = {
    search: <SearchView search={search} />,
    websites: <WebsitesTable websites={websites} />,
    results: <ProductResults products={products} onDetails={onDetails} />,
    deals: <BestDeals summary={summary} />,
    prices: <PriceComparison products={products} />,
    detail: <ProductDetail product={selectedProduct} />,
    history: <HistoryPanel historyItems={historyItems} onOpen={onOpenHistory} />
  }[active];

  return (
    <section className="section-block dashboard-section" id="dashboard">
      <div className="section-heading">
        <span>Live Easy Shop data</span>
        <h2>Search, compare, and choose the strongest deal.</h2>
        {lastUpdated ? <p>Updated {lastUpdated.toLocaleTimeString()}</p> : null}
      </div>
      <DataOverview
        search={search}
        websites={websites}
        products={products}
        summary={summary}
        refreshing={refreshing}
        searchId={searchId}
        onRefresh={onRefresh}
        onReanalyze={onReanalyze}
      />
      {error ? (
        <div className="alert-message">
          <AlertTriangle size={18} />
          {error}
        </div>
      ) : null}
      <DashboardTabs active={active} setActive={setActive} counts={counts} />
      <div className="dashboard-view">{activeView}</div>
    </section>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="review-card">
      <div className="review-card-head">
        <div className="review-avatar" aria-hidden="true">
          {initials(review.name)}
        </div>
        <div>
          <strong>{review.name}</strong>
          <small>{review.role}</small>
        </div>
      </div>
      <div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
        {Array.from({ length: review.rating }, (_, index) => (
          <Star key={index} size={15} fill="currentColor" />
        ))}
      </div>
      <p>{review.text}</p>
    </article>
  );
}

function ReviewsSection() {
  return (
    <section className="section-block reviews-section" id="reviews" aria-labelledby="reviews-heading">
      <div className="section-heading reviews-heading">
        <h2 id="reviews-heading">Feedback</h2>
      </div>
      <div className="reviews-marquee-stack">
        <Marquee pauseOnHover repeat={3} ariaLabel="Sample positive Easy Shop reviews">
          {customerReviews.map((review) => (
            <ReviewCard key={review.name} review={review} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section className="contact-section" id="contact">
      <div className="contact-copy">
        <LogoLockup compact />
        <h2>Har Product Ka Best Deal Finder.</h2>
        <p>
          Easy Shop keeps product discovery, supported apps, best deal ranking, and buyer support in one clear place.
        </p>
      </div>
      <div className="contact-details" aria-label="Easy Shop contact details">
        <a href="mailto:support@easyshop.pk">
          <Mail size={21} />
          <span>
            <small>Email</small>
            support@easyshop.pk
          </span>
        </a>
        <a href="tel:+923000000000">
          <Phone size={21} />
          <span>
            <small>Phone</small>
            +92 300 000 0000
          </span>
        </a>
        <span>
          <MapPin size={21} />
          <span>
            <small>Office</small>
            Lahore, Pakistan
          </span>
        </span>
      </div>
    </section>
  );
}

export default function App() {
  const [active, setActive] = useState("search");
  const [form, setForm] = useState({ productName: "" });
  const [searchId, setSearchId] = useState("");
  const [search, setSearch] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const counts = useMemo(
    () => ({
      websites: websites.length,
      results: products.length,
      deals: summary?.cheapestProducts?.length || 0,
      history: historyItems.length
    }),
    [historyItems.length, products.length, summary?.cheapestProducts?.length, websites.length]
  );

  const loadHistory = useCallback(async () => {
    const payload = await getHistory();
    setHistoryItems(payload.history || []);
  }, []);

  const loadResults = useCallback(async (id) => {
    const payload = await getResults(id);
    setSearch(payload.search);
    setWebsites(payload.websites || []);
    setProducts(payload.products || []);
    setSummary(payload.summary || {});
    setLastUpdated(new Date());
    return payload.search?.status;
  }, []);

  useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [loadHistory]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingSearchId = params.get("searchId");
    if (existingSearchId) {
      setSearchId(existingSearchId);
    }
  }, []);

  useEffect(() => {
    if (!searchId) return undefined;
    let cancelled = false;

    async function tick() {
      try {
        setRefreshing(true);
        const status = await loadResults(searchId);
        if (!cancelled && (status === "completed" || status === "failed")) {
          await loadHistory();
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    tick();
    if (search?.status === "completed" || search?.status === "failed") return undefined;

    const timer = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadHistory, loadResults, search?.status, searchId]);

  useEffect(() => {
    if (!selectedProduct && products[0]) {
      setSelectedProduct(products[0]);
    }
  }, [products, selectedProduct]);

  async function handleSubmit(event) {
    event.preventDefault();
    const productName = form.productName.trim();
    if (!productName) return;

    setLoading(true);
    setError("");
    setSelectedProduct(null);
    setProducts([]);
    setWebsites([]);

    try {
      const payload = await createSearch({ productName, location: DEFAULT_MARKET_LOCATION });
      setSearchId(payload.searchId);
      setSearch(payload.search);
      window.history.replaceState(null, "", `?searchId=${payload.searchId}`);
      setActive("search");
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (requestError) {
      setError(requestError.message);
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setLoading(false);
    }
  }

  async function openProductDetail(product) {
    setSelectedProduct(product);
    setActive("detail");
    if (!product.id) return;

    try {
      const payload = await getProduct(product.id);
      setSelectedProduct(payload.product);
    } catch {
      setSelectedProduct(product);
    }
  }

  async function openHistorySearch(id) {
    setSearchId(id);
    setSelectedProduct(null);
    window.history.replaceState(null, "", `?searchId=${id}`);
    setActive("search");
    await loadResults(id);
  }

  async function handleRefresh() {
    if (!searchId) return;
    setRefreshing(true);
    try {
      await loadResults(searchId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReanalyze() {
    if (!searchId) return;
    setRefreshing(true);
    try {
      await rerunAnalysis(searchId);
      await loadResults(searchId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="site-shell">
      <LiquidGlassFilter />
      <Topbar />
      <HeroSection
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        loading={loading}
      />
      <PlatformShowcase />
      <DashboardSection
        active={active}
        setActive={setActive}
        counts={counts}
        search={search}
        websites={websites}
        products={products}
        summary={summary}
        selectedProduct={selectedProduct}
        historyItems={historyItems}
        onDetails={openProductDetail}
        onOpenHistory={openHistorySearch}
        error={error}
        refreshing={refreshing}
        searchId={searchId}
        onRefresh={handleRefresh}
        onReanalyze={handleReanalyze}
        lastUpdated={lastUpdated}
      />
      <ReviewsSection />
      <ContactSection />
    </main>
  );
}
