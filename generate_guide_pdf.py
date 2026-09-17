import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

# Target output PDF file
OUTPUT_PDF = "D:/flumenx/flumenxConectOS/FlumenX_ConectOS_Configuration_and_Integrations_Manual.pdf"

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.saveState()
                
                # Running Header
                self.setFont("Helvetica-Bold", 8)
                self.setFillColor(HexColor("#1e1b4b"))
                self.drawString(48, 755, "FLUMENX CONECTOS")
                self.setFont("Helvetica", 8)
                self.setFillColor(HexColor("#64748b"))
                self.drawString(145, 755, "|   Enterprise Configuration & Integrations Manual")
                
                self.setStrokeColor(HexColor("#cbd5e1"))
                self.setLineWidth(0.5)
                self.line(48, 747, 564, 747)
                
                # Running Footer
                self.line(48, 48, 564, 48)
                self.setFont("Helvetica", 8)
                self.setFillColor(HexColor("#64748b"))
                self.drawString(48, 36, "Confidential — Internal Digital Marketing Operations Platform")
                
                page_str = f"Page {self._pageNumber} of {num_pages}"
                self.drawRightString(564, 36, page_str)
                self.restoreState()
            super().showPage()
        super().save()

def create_manual():
    # Page setup: Letter (612 x 792 pt). Printable width = 612 - 48*2 = 516 pt
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=letter,
        leftMargin=48,
        rightMargin=48,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Color Palette
    c_primary = HexColor("#0f172a")     # Slate 900
    c_indigo = HexColor("#1e1b4b")      # Indigo 950
    c_blue = HexColor("#2563eb")        # Blue 600
    c_darkblue = HexColor("#1d4ed8")    # Blue 700
    c_slate = HexColor("#475569")       # Slate 600
    c_lightslate = HexColor("#64748b")  # Slate 500
    c_border = HexColor("#cbd5e1")      # Slate 300
    c_lightbg = HexColor("#f8fafc")     # Slate 50

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=21,
        leading=25,
        textColor=HexColor('#ffffff'),
        alignment=TA_LEFT
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=HexColor('#cbd5e1'),
        alignment=TA_LEFT
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=c_indigo,
        spaceBefore=12,
        spaceAfter=4,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14.5,
        textColor=c_darkblue,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'Header3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=c_primary,
        spaceBefore=5,
        spaceAfter=2,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyMain',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_primary,
        spaceBefore=2,
        spaceAfter=2
    )

    bullet_style = ParagraphStyle(
        'BulletMain',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=c_primary,
        leftIndent=12,
        firstLineIndent=-8,
        spaceBefore=1.5,
        spaceAfter=1.5
    )

    code_style = ParagraphStyle(
        'CodeText',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=HexColor('#e2e8f0')
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=HexColor('#ffffff')
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=c_primary
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=c_primary
    )

    callout_text = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=HexColor('#1e293b')
    )

    story = []

    def make_callout(title, text, box_type='info'):
        colors = {
            'info': (HexColor('#eff6ff'), HexColor('#3b82f6'), 'INFO &amp; BEST PRACTICE:'),
            'warning': (HexColor('#fffbeb'), HexColor('#f59e0b'), 'CRITICAL REQUIREMENT:'),
            'tip': (HexColor('#ecfdf5'), HexColor('#10b981'), 'DEVELOPER TIP:'),
            'security': (HexColor('#fdf2f8'), HexColor('#ec4899'), 'SECURITY PROTOCOL:')
        }
        bg, border, default_title = colors.get(box_type, colors['info'])
        display_title = title or default_title
        
        content = [
            Paragraph(f"<b><font color='{border.hexval()}'>{display_title}</font></b>", callout_text),
            Spacer(1, 2),
            Paragraph(text, callout_text)
        ]
        
        t = Table([[content]], colWidths=[516])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg),
            ('BOX', (0, 0), (-1, -1), 0.5, border),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LINELEFT', (0, 0), (-1, -1), 3.5, border),
        ]))
        return t

    def make_code_block(code_lines):
        code_p = Paragraph("<br/>".join(code_lines), code_style)
        t = Table([[code_p]], colWidths=[516])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#0f172a')),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#334155')),
        ]))
        return t

    # -------------------------------------------------------------
    # PAGE 1: FORMAL COVER PAGE
    # -------------------------------------------------------------
    cover_table_data = [
        [
            Paragraph("FLUMENX CONECTOS  •  INTERNAL DIGITAL MARKETING OPERATIONS PLATFORM", ParagraphStyle('Badge', fontName='Helvetica-Bold', fontSize=8, textColor=HexColor('#38bdf8'))),
        ],
        [
            Spacer(1, 3),
        ],
        [
            Paragraph("Platform Configuration, Environment Setup &amp; Channel Integrations Manual", title_style),
        ],
        [
            Spacer(1, 3),
        ],
        [
            Paragraph("Comprehensive Technical Specification &amp; Step-by-Step Operator Guide covering Environment Variables (.env), Cryptographic Vault (AES-256-GCM), Multi-Tenant RBAC, and External APIs (WhatsApp, Instagram, Twilio, Meta &amp; Google Ads).", subtitle_style),
        ]
    ]

    cover_banner = Table(cover_table_data, colWidths=[516])
    cover_banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#0f172a')),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(cover_banner)
    story.append(Spacer(1, 10))

    meta_info = [
        [Paragraph("<b>Document Version:</b>", table_cell_bold), Paragraph("2.4.0 (Enterprise Release)", table_cell_style)],
        [Paragraph("<b>Classification:</b>", table_cell_bold), Paragraph("Confidential — Agency Technical Operations &amp; Engineering", table_cell_style)],
        [Paragraph("<b>Target Audience:</b>", table_cell_bold), Paragraph("Super Administrators, Agency Account Directors, DevOps Engineers", table_cell_style)],
        [Paragraph("<b>Runtime Architecture:</b>", table_cell_bold), Paragraph("Next.js 14 App Router, Express.js REST Engine, MongoDB 7.0+, Node.js 20+", table_cell_style)],
        [Paragraph("<b>Cryptographic Standard:</b>", table_cell_bold), Paragraph("AES-256-GCM Credential Vault, HMAC-SHA256 Signature Verification", table_cell_style)],
        [Paragraph("<b>Published:</b>", table_cell_bold), Paragraph("September 2026", table_cell_style)],
    ]
    meta_table = Table(meta_info, colWidths=[130, 386])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_lightbg),
        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor('#f1f5f9')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Document Roadmap &amp; Table of Contents</b>", h2_style))
    
    toc_data = [
        [Paragraph("Section", table_header_style), Paragraph("Topic &amp; Coverage", table_header_style), Paragraph("Page", table_header_style)],
        [Paragraph("<b>Section 1</b>", table_cell_bold), Paragraph("Architecture Blueprint, Multi-Tenancy &amp; Operational Scope", table_cell_style), Paragraph("Page 2", table_cell_style)],
        [Paragraph("<b>Section 2</b>", table_cell_bold), Paragraph("Infrastructure &amp; Server Environment Variables (.env)", table_cell_style), Paragraph("Page 3", table_cell_style)],
        [Paragraph("<b>Section 3</b>", table_cell_bold), Paragraph("In-App Client Integrations Hub (Centralized UI Guide)", table_cell_style), Paragraph("Page 4", table_cell_style)],
        [Paragraph("<b>Section 4</b>", table_cell_bold), Paragraph("Step-by-Step Channel Integrations (WhatsApp, Instagram, Twilio, Email)", table_cell_style), Paragraph("Pages 5 - 6", table_cell_style)],
        [Paragraph("<b>Section 5</b>", table_cell_bold), Paragraph("Advertising &amp; Lead Ingestion Setup (Meta Ads &amp; Google Ads)", table_cell_style), Paragraph("Page 7", table_cell_style)],
        [Paragraph("<b>Section 6</b>", table_cell_bold), Paragraph("Local Webhook Development, Tunnels &amp; Webhook Verification", table_cell_style), Paragraph("Page 8", table_cell_style)],
        [Paragraph("<b>Section 7</b>", table_cell_bold), Paragraph("Security Protocols, AES-256 Secret Encryption &amp; RBAC Matrix", table_cell_style), Paragraph("Page 9", table_cell_style)],
        [Paragraph("<b>Section 8</b>", table_cell_bold), Paragraph("Troubleshooting, Error Diagnostics &amp; Go-Live Checklist", table_cell_style), Paragraph("Page 10", table_cell_style)],
    ]
    t_toc = Table(toc_data, colWidths=[65, 395, 56])
    t_toc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_toc)

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 2: ARCHITECTURE BLUEPRINT & SCOPE
    # -------------------------------------------------------------
    story.append(Paragraph("1. Architecture Blueprint &amp; Operational Scope", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "FlumenX ConectOS operates as a multi-tenant digital marketing operations platform. To balance high security, zero cross-tenant credential leakage, and operational flexibility, system configuration is split into two distinct tiers:",
        body_style
    ))
    story.append(Paragraph("• <b>Tier 1: Global Infrastructure &amp; System Secrets (.env):</b> Managed exclusively by platform DevOps and agency administrators. These variables control database clustering, session JWT signing, server port bindings, and the master cryptographic symmetric key.", bullet_style))
    story.append(Paragraph("• <b>Tier 2: Tenant-Level Channel Credentials (In-App Integrations Hub):</b> Configured per client workspace directly inside the UI. Each client can independently register and manage their own WhatsApp Business account, Instagram DMs, Twilio SMS numbers, and Meta/Google ad accounts without developer intervention.", bullet_style))

    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>End-to-End Cryptographic Dataflow</b>", h2_style))
    
    flow_data = [
        [Paragraph("Step", table_header_style), Paragraph("System Component", table_header_style), Paragraph("Functional Action &amp; Security Boundary", table_header_style)],
        [
            Paragraph("<b>1</b>", table_cell_bold),
            Paragraph("Client User / Admin", table_cell_style),
            Paragraph("Submits API keys or tokens in the <b>Integrations Hub</b> (e.g. WhatsApp permanent token, Twilio Auth Token).", table_cell_style)
        ],
        [
            Paragraph("<b>2</b>", table_cell_bold),
            Paragraph("Next.js Frontend", table_cell_style),
            Paragraph("Transmits credentials over TLS/HTTPS with JWT authorization bearer header to Express API gateway.", table_cell_style)
        ],
        [
            Paragraph("<b>3</b>", table_cell_bold),
            Paragraph("Express REST Gateway", table_cell_style),
            Paragraph("Validates tenant membership via RBAC middleware; invokes <code>EncryptionService</code>.", table_cell_style)
        ],
        [
            Paragraph("<b>4</b>", table_cell_bold),
            Paragraph("AES-256-GCM Vault", table_cell_style),
            Paragraph("Encrypts secret using master <code>ENCRYPTION_SECRET_KEY</code> with unique random IV and authentication tag.", table_cell_style)
        ],
        [
            Paragraph("<b>5</b>", table_cell_bold),
            Paragraph("MongoDB Collection", table_cell_style),
            Paragraph("Stores encrypted ciphertext in <code>communicationproviders</code> tagged with <code>clientId</code>.", table_cell_style)
        ],
        [
            Paragraph("<b>6</b>", table_cell_bold),
            Paragraph("Outbound Dispatcher", table_cell_style),
            Paragraph("When dispatching a lead message or syncing ads, token is decrypted in-memory and dispatched to external API.", table_cell_style)
        ],
    ]
    t_flow = Table(flow_data, colWidths=[35, 130, 351])
    t_flow.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_flow)

    story.append(Spacer(1, 12))
    story.append(make_callout(
        "TENANT ISOLATION GUARANTEE",
        "Every database query for communication channels, conversations, leads, and ad metrics is automatically scoped by the user's active <code>clientId</code>. Cross-tenant access is strictly blocked by RBAC middleware, preventing data leaks across clients.",
        "security"
    ))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 3: INFRASTRUCTURE ENVIRONMENT VARIABLES
    # -------------------------------------------------------------
    story.append(Paragraph("2. Infrastructure &amp; Environment Variables (.env)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The backend runtime validates all environment variables against a strict Zod schema in <code>backend/src/config/env.ts</code>. Missing or malformed required variables prevent application boot:",
        body_style
    ))

    env_table_data = [
        [
            Paragraph("Variable Name", table_header_style),
            Paragraph("Default / Example", table_header_style),
            Paragraph("Req.", table_header_style),
            Paragraph("Description &amp; Operational Function", table_header_style)
        ],
        [
            Paragraph("<b>PORT</b>", table_cell_bold),
            Paragraph("<code>5000</code>", table_cell_style),
            Paragraph("Opt", table_cell_style),
            Paragraph("TCP port on which Express listens for incoming HTTP and webhook requests.", table_cell_style)
        ],
        [
            Paragraph("<b>NODE_ENV</b>", table_cell_bold),
            Paragraph("<code>development</code>", table_cell_style),
            Paragraph("Opt", table_cell_style),
            Paragraph("Runtime environment mode: <code>development</code>, <code>production</code>, or <code>test</code>.", table_cell_style)
        ],
        [
            Paragraph("<b>MONGODB_URI</b>", table_cell_bold),
            Paragraph("<code>mongodb://localhost:27017/flumenx_conect_os</code>", table_cell_style),
            Paragraph("<b>YES</b>", table_cell_style),
            Paragraph("MongoDB connection string. In production, use MongoDB Atlas replica set URI with TLS enabled.", table_cell_style)
        ],
        [
            Paragraph("<b>JWT_SECRET</b>", table_cell_bold),
            Paragraph("<i>Min 32-char random string</i>", table_cell_style),
            Paragraph("<b>YES</b>", table_cell_style),
            Paragraph("Cryptographic secret key used by HMAC-SHA256 to sign session authentication tokens.", table_cell_style)
        ],
        [
            Paragraph("<b>JWT_EXPIRES_IN</b>", table_cell_bold),
            Paragraph("<code>7d</code>", table_cell_style),
            Paragraph("Opt", table_cell_style),
            Paragraph("Session token lifespan before re-authentication is enforced (e.g. <code>24h</code>, <code>7d</code>).", table_cell_style)
        ],
        [
            Paragraph("<b>ENCRYPTION_SECRET_KEY</b>", table_cell_bold),
            Paragraph("<i>64-hex char string (32 bytes)</i>", table_cell_style),
            Paragraph("<b>YES</b>", table_cell_style),
            Paragraph("Master symmetric encryption key utilized by the AES-256-GCM vault to encrypt tokens in MongoDB.", table_cell_style)
        ],
        [
            Paragraph("<b>CORS_ORIGIN</b>", table_cell_bold),
            Paragraph("<code>http://localhost:3000</code>", table_cell_style),
            Paragraph("<b>YES</b>", table_cell_style),
            Paragraph("Allowed origin for CORS. In production, set to live domain (e.g. <code>https://app.yourdomain.com</code>).", table_cell_style)
        ],
        [
            Paragraph("<b>INITIAL_ADMIN_EMAIL</b>", table_cell_bold),
            Paragraph("<code>admin@flumenx.com</code>", table_cell_style),
            Paragraph("<b>YES</b>", table_cell_style),
            Paragraph("Seed email address for platform provisioning on fresh MongoDB initialization.", table_cell_style)
        ],
        [
            Paragraph("<b>INITIAL_ADMIN_PASSWORD</b>", table_cell_bold),
            Paragraph("<i>Min 8 characters</i>", table_cell_style),
            Paragraph("<b>YES</b>", table_cell_style),
            Paragraph("Seed password for initial Super Administrator bootstrap.", table_cell_style)
        ],
    ]

    t_env = Table(env_table_data, colWidths=[120, 130, 30, 236])
    t_env.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_env)

    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Frontend Environment Variables (frontend/.env.local)</b>", h2_style))
    story.append(Paragraph(
        "The Next.js 14 client application reads client-exposed variables prefixed with <code>NEXT_PUBLIC_</code> during build and client hydration:",
        body_style
    ))

    fe_table_data = [
        [Paragraph("Variable Name", table_header_style), Paragraph("Local Dev Value", table_header_style), Paragraph("Production Recommendation", table_header_style)],
        [
            Paragraph("<b>NEXT_PUBLIC_API_URL</b>", table_cell_bold),
            Paragraph("<code>http://localhost:5000/api/v1</code>", table_cell_style),
            Paragraph("Set to your public HTTPS API endpoint, e.g. <code>https://api.flumenx.yourdomain.com/api/v1</code>", table_cell_style)
        ]
    ]
    t_fe = Table(fe_table_data, colWidths=[140, 160, 216])
    t_fe.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_darkblue),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_fe)

    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Generating Production Cryptographic Keys</b>", h2_style))
    story.append(Paragraph(
        "Execute either of the following CLI commands to generate a random 64-hex character encryption key for <code>ENCRYPTION_SECRET_KEY</code>:",
        body_style
    ))
    story.append(make_code_block([
        "# Option A: Using Node.js crypto module (recommended):",
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        "",
        "# Option B: Using OpenSSL CLI:",
        "openssl rand -hex 32"
    ]))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 4: CENTRALIZED IN-APP INTEGRATIONS HUB
    # -------------------------------------------------------------
    story.append(Paragraph("3. In-App Client Integrations Hub (Centralized UI)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "To configure channels, ad accounts, and webhooks, navigate in the browser to: <b>Client Workspace &gt; Integrations Hub</b> (<code>/client/integrations</code>).",
        body_style
    ))
    story.append(Paragraph(
        "All configuration forms feature interactive <b>(i) Information Icons</b> providing inline guidance, developer console URLs, required permission scopes, and step-by-step token generation instructions.",
        body_style
    ))

    hub_features = [
        [
            Paragraph("Hub Tab", table_header_style),
            Paragraph("Supported Providers &amp; Platforms", table_header_style),
            Paragraph("Key Capabilities", table_header_style)
        ],
        [
            Paragraph("<b>1. Messaging &amp; Channels</b>", table_cell_bold),
            Paragraph("• WhatsApp Cloud API<br/>• Instagram Direct Messaging<br/>• Facebook Messenger<br/>• Twilio 2-Way SMS Gateway<br/>• Resend / Custom SMTP Email", table_cell_style),
            Paragraph("Enables sending and receiving messages in the Unified Inbox, CRM Lead Messaging modal, and automated workflow auto-replies. Supports testing connection and toggling default outbound channel.", table_cell_style)
        ],
        [
            Paragraph("<b>2. Advertising &amp; Campaigns</b>", table_cell_bold),
            Paragraph("• Meta Marketing API (Facebook/Instagram Ads)<br/>• Google Ads MCC / Customer Account", table_cell_style),
            Paragraph("Automated sync of ad spend, impressions, clicks, CPC, ROAS, and instant lead capture from Meta Instant Lead Forms directly into CRM pipeline.", table_cell_style)
        ],
        [
            Paragraph("<b>3. Webhook &amp; Callback URLs</b>", table_cell_bold),
            Paragraph("• Inbound Messaging Webhook<br/>• Webhook Verify Tokens<br/>• Lead Intake Ingestion Webhook", table_cell_style),
            Paragraph("Ready-to-copy endpoints for Meta App Dashboard, Twilio Webhook settings, and website forms. Displays active verify tokens with copy-to-clipboard functionality.", table_cell_style)
        ],
    ]
    t_hub = Table(hub_features, colWidths=[120, 160, 236])
    t_hub.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_hub)

    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Credential Security &amp; Secret Masking</b>", h2_style))
    story.append(Paragraph(
        "When credentials are submitted via the Integrations UI:",
        body_style
    ))
    story.append(Paragraph("1. The backend encrypts access tokens and passwords using <code>AES-256-GCM</code> with unique initialization vectors (IV) before writing to the <code>communicationproviders</code> collection.", bullet_style))
    story.append(Paragraph("2. When credentials are sent back to the frontend, sensitive fields (tokens, secrets, passwords) are masked as <code>••••••••</code> to prevent exposure via browser inspector or network sniffing.", bullet_style))
    story.append(Paragraph("3. When testing connections via the <b>Test Connection</b> button, the backend decrypts tokens in-memory, executes a lightweight ping to the external provider API, and reports connection status (HTTP 200 / valid authentication).", bullet_style))

    story.append(Spacer(1, 10))
    story.append(make_callout(
        "LEAD MESSAGING CRM SHORTCUT",
        "Configuring a default messaging provider (e.g. WhatsApp or Twilio) activates the direct 'Message' action button inside the Leads CRM table (/client/leads) and Lead Detail View (/client/leads/[leadId]), allowing agents to trigger WhatsApp Web, send SMS, or launch the Unified Inbox with 1 click.",
        "tip"
    ))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 5: STEP-BY-STEP CHANNEL INTEGRATIONS (WHATSAPP & IG)
    # -------------------------------------------------------------
    story.append(Paragraph("4. Step-by-Step Channel Integrations Guide", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    # WhatsApp Cloud API
    story.append(Paragraph("4.1 WhatsApp Cloud API (Meta for Developers)", h2_style))
    story.append(Paragraph(
        "Connect official WhatsApp Business numbers to send outbound messages, manage incoming chats, and execute automated CRM lead follow-ups.",
        body_style
    ))

    wa_steps = [
        [Paragraph("Step", table_header_style), Paragraph("Action Required", table_header_style), Paragraph("Console Location &amp; Detailed Instructions", table_header_style)],
        [
            Paragraph("<b>1</b>", table_cell_bold),
            Paragraph("<b>Create Meta App</b>", table_cell_style),
            Paragraph("Go to <b>developers.facebook.com</b> &gt; <b>My Apps</b> &gt; <b>Create App</b>. Select app type: <b>Business</b>. Name the app after your agency or client.", table_cell_style)
        ],
        [
            Paragraph("<b>2</b>", table_cell_bold),
            Paragraph("<b>Add WhatsApp Product</b>", table_cell_style),
            Paragraph("In App Dashboard, click <b>Add Product</b> and select <b>WhatsApp</b>. Complete business onboarding and add a payment method if sending marketing templates.", table_cell_style)
        ],
        [
            Paragraph("<b>3</b>", table_cell_bold),
            Paragraph("<b>Retrieve Phone &amp; WABA IDs</b>", table_cell_style),
            Paragraph("Navigate to <b>WhatsApp &gt; API Setup</b>. Copy the numeric <b>Phone Number ID</b> (e.g. <code>104928374829102</code>) and <b>WhatsApp Business Account ID</b> (WABA ID).", table_cell_style)
        ],
        [
            Paragraph("<b>4</b>", table_cell_bold),
            Paragraph("<b>Generate Permanent Token</b>", table_cell_style),
            Paragraph("Temporary tokens expire in 24h. For permanent access: Go to <b>business.facebook.com &gt; Business Settings &gt; System Users</b>. Click <b>Add</b> (Role: Admin). Click <b>Generate New Token</b>, select your App, and enable permissions: <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.", table_cell_style)
        ],
        [
            Paragraph("<b>5</b>", table_cell_bold),
            Paragraph("<b>Configure Webhook</b>", table_cell_style),
            Paragraph("In Meta App Dashboard &gt; <b>WhatsApp &gt; Configuration &gt; Edit Webhook</b>:<br/>• Callback URL: <code>https://your-domain.com/api/v1/conversations/webhooks/whatsapp</code><br/>• Verify Token: Paste your chosen Verify Token (e.g. <code>flumenx_wa_verify_2026</code>)<br/>• Subscribed Fields: Click <b>Manage</b> and check <b>messages</b>.", table_cell_style)
        ],
        [
            Paragraph("<b>6</b>", table_cell_bold),
            Paragraph("<b>Save in FlumenX Hub</b>", table_cell_style),
            Paragraph("Paste Phone Number ID, WABA ID, and Permanent Access Token into <b>Integrations Hub &gt; WhatsApp</b>. Click <b>Test Connection</b>, then <b>Save Channel</b>.", table_cell_style)
        ],
    ]
    t_wa = Table(wa_steps, colWidths=[38, 120, 358])
    t_wa.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_wa)

    story.append(Spacer(1, 8))

    # Instagram Direct Messaging
    story.append(Paragraph("4.2 Instagram Direct Messaging &amp; Facebook Messenger", h2_style))
    story.append(Paragraph(
        "Manage Direct Messages (DMs) from Instagram and Messenger inside the Unified Inbox alongside CRM records.",
        body_style
    ))

    ig_steps = [
        [Paragraph("Step", table_header_style), Paragraph("Requirement", table_header_style), Paragraph("Instructions &amp; Permissions", table_header_style)],
        [
            Paragraph("<b>1</b>", table_cell_bold),
            Paragraph("<b>Professional Account</b>", table_cell_style),
            Paragraph("Ensure the Instagram account is set to <b>Creator</b> or <b>Business</b> and linked to the official Facebook Page in Meta Business Suite.", table_cell_style)
        ],
        [
            Paragraph("<b>2</b>", table_cell_bold),
            Paragraph("<b>Message Access Permission</b>", table_cell_style),
            Paragraph("In Instagram mobile app: <b>Settings &gt; Privacy &gt; Messages &gt; Connected Tools</b>: Toggle <b>Allow Access to Messages</b> to ON.", table_cell_style)
        ],
        [
            Paragraph("<b>3</b>", table_cell_bold),
            Paragraph("<b>Token Permissions</b>", table_cell_style),
            Paragraph("Generate a Page Access Token with: <code>instagram_basic</code>, <code>instagram_manage_messages</code>, <code>pages_manage_metadata</code>, <code>pages_read_engagement</code>.", table_cell_style)
        ],
        [
            Paragraph("<b>4</b>", table_cell_bold),
            Paragraph("<b>Webhook Subscriptions</b>", table_cell_style),
            Paragraph("In Meta App Dashboard &gt; Webhooks &gt; Select <b>Instagram</b>: Subscribe to <code>messages</code> and <code>messaging_postbacks</code>.", table_cell_style)
        ],
    ]
    t_ig = Table(ig_steps, colWidths=[38, 120, 358])
    t_ig.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_ig)

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 6: STEP-BY-STEP CHANNEL INTEGRATIONS (TWILIO & EMAIL)
    # -------------------------------------------------------------
    story.append(Paragraph("4.3 Twilio Two-Way SMS Gateway", h2_style))
    story.append(Paragraph(
        "Enables text messaging to CRM leads and automated SMS follow-ups on lead status progression.",
        body_style
    ))

    twilio_steps = [
        [Paragraph("Field", table_header_style), Paragraph("Console Location", table_header_style), Paragraph("Format &amp; Description", table_header_style)],
        [
            Paragraph("<b>Account SID</b>", table_cell_bold),
            Paragraph("<b>twilio.com/console</b> &gt; Dashboard", table_cell_style),
            Paragraph("34-character string starting with <code>AC...</code>. Found under 'Account Info'.", table_cell_style)
        ],
        [
            Paragraph("<b>Auth Token</b>", table_cell_bold),
            Paragraph("<b>twilio.com/console</b> &gt; Dashboard", table_cell_style),
            Paragraph("Secret authentication token. Click 'Show' to copy.", table_cell_style)
        ],
        [
            Paragraph("<b>Sender Phone Number</b>", table_cell_bold),
            Paragraph("Phone Numbers &gt; Active Numbers", table_cell_style),
            Paragraph("SMS-enabled phone number in international E.164 format, e.g. <code>+12025550199</code>.", table_cell_style)
        ],
        [
            Paragraph("<b>Inbound Webhook URL</b>", table_cell_bold),
            Paragraph("Phone Numbers &gt; Active &gt; Messaging", table_cell_style),
            Paragraph("Under 'A Message Comes In', select <b>Webhook (HTTP POST)</b> and enter:<br/><code>https://your-domain.com/api/v1/conversations/webhooks/twilio</code>", table_cell_style)
        ],
    ]
    t_tw = Table(twilio_steps, colWidths=[120, 150, 246])
    t_tw.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_tw)

    story.append(Spacer(1, 10))
    story.append(Paragraph("4.4 Email Dispatch (Resend &amp; Custom SMTP)", h2_style))
    story.append(Paragraph(
        "FlumenX supports two email delivery engines for outgoing lead communications, portal invites, and alert notifications:",
        body_style
    ))

    email_comp = [
        [Paragraph("Feature / Attribute", table_header_style), Paragraph("Option A: Resend (Recommended)", table_header_style), Paragraph("Option B: Custom SMTP", table_header_style)],
        [
            Paragraph("<b>Setup Simplicity</b>", table_cell_bold),
            Paragraph("Single API key (<code>re_...</code>). Minimal configuration.", table_cell_style),
            Paragraph("Requires Host, Port, Username, Password, TLS settings.", table_cell_style)
        ],
        [
            Paragraph("<b>Deliverability &amp; DNS</b>", table_cell_bold),
            Paragraph("Automated DKIM, SPF, and DMARC verification via Resend dashboard.", table_cell_style),
            Paragraph("Requires manual MX, SPF, and DKIM configuration with email provider.", table_cell_style)
        ],
        [
            Paragraph("<b>Supported Providers</b>", table_cell_bold),
            Paragraph("Resend Cloud Engine.", table_cell_style),
            Paragraph("Mailgun, SendGrid, Amazon SES, Google Workspace, Postmark, etc.", table_cell_style)
        ],
        [
            Paragraph("<b>Configuration Fields</b>", table_cell_bold),
            Paragraph("• API Key (<code>re_...</code>)<br/>• From Email (e.g. <code>team@client.com</code>)<br/>• Sender Name (e.g. <code>Acme Sales</code>)", table_cell_style),
            Paragraph("• Host (e.g. <code>smtp.mailgun.org</code>)<br/>• Port (587 TLS or 465 SSL)<br/>• User &amp; Password / App Password<br/>• From Email &amp; Sender Name", table_cell_style)
        ],
    ]
    t_em = Table(email_comp, colWidths=[110, 200, 206])
    t_em.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_darkblue),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_em)

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 7: ADVERTISING & LEAD INGESTION
    # -------------------------------------------------------------
    story.append(Paragraph("5. Advertising &amp; Lead Ingestion Setup", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Connect advertising accounts under <b>Integrations Hub &gt; Advertising &amp; Ad Accounts</b> to synchronize daily campaign spend, impressions, clicks, CPC, ROAS, and capture incoming leads instantaneously.",
        body_style
    ))

    story.append(Paragraph("5.1 Meta Marketing API (Facebook &amp; Instagram Ads)", h2_style))
    story.append(Paragraph(
        "Required for syncing ad spend and automatically importing Facebook Instant Lead Form submissions directly into the CRM pipeline:",
        body_style
    ))
    story.append(Paragraph("• <b>Ad Account ID:</b> Numeric ID prefixed with <code>act_</code> (e.g. <code>act_198273645019</code>), found in Meta Ads Manager URL or Account Settings.", bullet_style))
    story.append(Paragraph("• <b>System User Access Token:</b> Generated in Meta Business Suite with the following required permissions:", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;1. <code>ads_read</code> (Read ad campaigns, adsets, and daily spend performance metrics)", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;2. <code>leads_retrieval</code> (Decrypt and download form field submissions)", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;3. <code>pages_show_list</code> and <code>pages_read_engagement</code> (Identify form source pages)", bullet_style))
    story.append(Paragraph("• <b>Lead Gen Webhook:</b> In Meta App Dashboard &gt; Webhooks &gt; Select <b>Page</b>: Subscribe to <code>leadgen</code>. Whenever a user submits an instant form on Facebook or Instagram, Meta sends a webhook payload to FlumenX, which auto-creates the CRM lead and executes welcome workflows.", bullet_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Instant Lead Webhook Payload Structure (Inbound JSON)</b>", h3_style))
    story.append(make_code_block([
        "{",
        "  \"object\": \"page\",",
        "  \"entry\": [{",
        "    \"id\": \"10293847561\",",
        "    \"changes\": [{",
        "      \"field\": \"leadgen\",",
        "      \"value\": {",
        "        \"leadgen_id\": \"981726354819\",",
        "        \"page_id\": \"10293847561\",",
        "        \"form_id\": \"382910485720\",",
        "        \"created_time\": 1758019200",
        "      }",
        "    }]",
        "  }]",
        "}"
    ]))

    story.append(Spacer(1, 8))
    story.append(Paragraph("5.2 Google Ads API (MCC &amp; Customer Accounts)", h2_style))
    story.append(Paragraph(
        "Synchronizes search, display, and YouTube ad campaign performance metrics into the client reporting analytics engine:",
        body_style
    ))
    story.append(Paragraph("• <b>Google Customer ID:</b> 10-digit ID formatted as <code>xxx-xxx-xxxx</code>, found in the top-right corner of Google Ads console.", bullet_style))
    story.append(Paragraph("• <b>Developer Token:</b> Approved developer token generated in your Google Ads Manager Account (MCC) under <b>Tools &amp; Settings &gt; API Center</b>.", bullet_style))
    story.append(Paragraph("• <b>Google Cloud OAuth 2.0 Credentials:</b> Client ID and Client Secret generated in Google Cloud Console with the Google Ads API enabled.", bullet_style))
    story.append(Paragraph("• <b>Refresh Token:</b> Offline OAuth 2.0 refresh token generated via token exchange script or OAuth playground.", bullet_style))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 8: LOCAL WEBHOOK DEVELOPMENT & TUNNELING
    # -------------------------------------------------------------
    story.append(Paragraph("6. Local Development, Webhooks &amp; Tunneling", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "External platforms (Meta for Developers, Twilio, Resend) deliver incoming messages and lead payloads via HTTP POST webhooks to your server. When running in a local development environment (<code>localhost:5000</code>), public external servers cannot route traffic to your private machine.",
        body_style
    ))
    story.append(Paragraph(
        "To test end-to-end inbound messaging and instant lead capture locally, establish a secure public HTTPS tunnel:",
        body_style
    ))

    story.append(Paragraph("<b>Option A: Using ngrok (Fastest Setup)</b>", h2_style))
    story.append(make_code_block([
        "# Run a public HTTPS tunnel forwarding to local Express server port 5000:",
        "npx ngrok http 5000",
        "",
        "# Output will display a Forwarding URL, for example:",
        "# Forwarding: https://8f92-203-110-44-12.ngrok-free.app -> http://localhost:5000"
    ]))

    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Option B: Using Cloudflare Tunnel (Free, No Rate Limits)</b>", h2_style))
    story.append(make_code_block([
        "# Install cloudflared and start an instant ad-hoc tunnel:",
        "cloudflared tunnel --url http://localhost:5000"
    ]))

    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Configuring Tunnel URLs in External Consoles:</b>", h2_style))
    story.append(Paragraph(
        "Replace <code>https://your-domain.com</code> with your temporary forwarding URL:",
        body_style
    ))

    tun_urls = [
        [Paragraph("Integration Target", table_header_style), Paragraph("Local Webhook Endpoint to Register in External Console", table_header_style)],
        [
            Paragraph("<b>WhatsApp Cloud Inbound</b>", table_cell_bold),
            Paragraph("<code>https://&lt;your-tunnel-url&gt;/api/v1/conversations/webhooks/whatsapp</code>", table_cell_style)
        ],
        [
            Paragraph("<b>Instagram &amp; Messenger</b>", table_cell_bold),
            Paragraph("<code>https://&lt;your-tunnel-url&gt;/api/v1/conversations/webhooks/meta</code>", table_cell_style)
        ],
        [
            Paragraph("<b>Twilio SMS Inbound</b>", table_cell_bold),
            Paragraph("<code>https://&lt;your-tunnel-url&gt;/api/v1/conversations/webhooks/twilio</code>", table_cell_style)
        ],
        [
            Paragraph("<b>Meta Lead Gen Webhook</b>", table_cell_bold),
            Paragraph("<code>https://&lt;your-tunnel-url&gt;/api/v1/conversations/webhooks/meta-leads</code>", table_cell_style)
        ],
    ]
    t_tun = Table(tun_urls, colWidths=[150, 366])
    t_tun.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_tun)

    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Verifying Webhook Challenge Handshake (cURL Test)</b>", h2_style))
    story.append(make_code_block([
        "# Test Meta webhook verification challenge locally via cURL:",
        "curl \"http://localhost:5000/api/v1/conversations/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=flumenx_wa_verify_2026&hub.challenge=115820124\"",
        "",
        "# Expected HTTP 200 response:",
        "115820124"
    ]))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 9: SECURITY, ENCRYPTION & RBAC
    # -------------------------------------------------------------
    story.append(Paragraph("7. Security Protocols &amp; Access Control (RBAC)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("7.1 AES-256-GCM Cryptographic Vault", h2_style))
    story.append(Paragraph(
        "FlumenX ConectOS enforces military-grade authenticated symmetric encryption on all stored API keys, refresh tokens, and authentication secrets using AES-256 in Galois/Counter Mode (GCM).",
        body_style
    ))
    story.append(Paragraph("• <b>Encryption Procedure:</b> For each secret, a cryptographically secure 16-byte random Initialization Vector (IV) is generated. The ciphertext and a 16-byte authentication tag are computed and serialized alongside the IV.", bullet_style))
    story.append(Paragraph("• <b>Integrity Guarantee:</b> In GCM mode, any tampering or corruption of the encrypted database document causes decryption to fail immediately with an authentication error, protecting against ciphertext modification attacks.", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("7.2 Role-Based Access Control (RBAC) Matrix", h2_style))
    story.append(Paragraph(
        "Platform permissions are enforced at both the Express API routing layer and MongoDB query layer across three built-in roles:",
        body_style
    ))

    rbac_data = [
        [Paragraph("Role Name", table_header_style), Paragraph("Scope &amp; Authority", table_header_style), Paragraph("Integration Privileges", table_header_style)],
        [
            Paragraph("<b>Super Administrator</b><br/>(<code>super_admin</code>)", table_cell_bold),
            Paragraph("Global cross-client access to all agency tenants, system audit logs, user provisioning, and RBAC matrix.", table_cell_style),
            Paragraph("Can view, edit, configure, and delete integrations across all client workspaces. Can inspect DLQ error dead-letters.", table_cell_style)
        ],
        [
            Paragraph("<b>Client Administrator</b><br/>(<code>client_admin</code>)", table_cell_bold),
            Paragraph("Full workspace authority over assigned client tenant, team members, CRM leads, and customer portal.", table_cell_style),
            Paragraph("Can connect, test, and manage channel credentials for their own workspace. Cannot view other client tenants.", table_cell_style)
        ],
        [
            Paragraph("<b>Client Staff</b><br/>(<code>client_staff</code>)", table_cell_bold),
            Paragraph("Operational specialist / media buyer privileges for managing leads, replying in inbox, and executing tasks.", table_cell_style),
            Paragraph("Can reply through configured channels; cannot view or modify raw API keys or connection secrets.", table_cell_style)
        ],
    ]
    t_rbac = Table(rbac_data, colWidths=[120, 196, 200])
    t_rbac.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_rbac)

    story.append(Spacer(1, 10))
    story.append(make_callout(
        "WEBHOOK SIGNATURE VERIFICATION",
        "Every incoming payload from Meta (X-Hub-Signature-256) and Twilio (X-Twilio-Signature) is cryptographically validated using HMAC-SHA256 against the client's configured App Secret before processing. Forged or unsigned payloads are rejected with HTTP 403 Forbidden.",
        "security"
    ))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # PAGE 10: TROUBLESHOOTING & GO-LIVE CHECKLIST
    # -------------------------------------------------------------
    story.append(Paragraph("8. Troubleshooting &amp; Diagnostics Guide", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_indigo, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Consult this reference table for diagnosing common configuration, authentication, and webhook delivery errors:",
        body_style
    ))

    trouble_data = [
        [Paragraph("Symptom / Error", table_header_style), Paragraph("Probable Root Cause", table_header_style), Paragraph("Corrective Action", table_header_style)],
        [
            Paragraph("<b>HTTP 401: Unauthorized</b><br/>(Provider Test Failed)", table_cell_bold),
            Paragraph("Access token expired, revoked, or invalid permissions assigned.", table_cell_style),
            Paragraph("Regenerate token in provider developer console (e.g. Meta System Users). Verify required scopes (e.g. <code>whatsapp_business_messaging</code>).", table_cell_style)
        ],
        [
            Paragraph("<b>Webhook Verification Failed</b><br/>(Meta Dashboard Error)", table_cell_bold),
            Paragraph("Verify Token mismatch between Meta Console and FlumenX Webhooks tab.", table_cell_style),
            Paragraph("Ensure the exact same token string is entered in both consoles. Verify server is reachable over public HTTPS URL.", table_cell_style)
        ],
        [
            Paragraph("<b>HTTP 422: Unprocessable</b><br/>(Outbound Message)", table_cell_bold),
            Paragraph("Recipient phone number not formatted in E.164 standard or 24h WhatsApp service window closed.", table_cell_style),
            Paragraph("Ensure phone numbers include country code (e.g. <code>+12025550199</code>). On WhatsApp, outside the 24h window, approved template messages are required.", table_cell_style)
        ],
        [
            Paragraph("<b>CORS Origin Blocked</b><br/>(Browser Console Error)", table_cell_bold),
            Paragraph("<code>CORS_ORIGIN</code> in <code>backend/.env</code> does not match the frontend URL.", table_cell_style),
            Paragraph("Update <code>CORS_ORIGIN</code> to match client URL (e.g. <code>http://localhost:3000</code> or your live production domain). Restart backend server.", table_cell_style)
        ],
        [
            Paragraph("<b>MongoDB Connection Refused</b>", table_cell_bold),
            Paragraph("Local mongod service not running or Atlas IP whitelist blocking request.", table_cell_style),
            Paragraph("In dev, ensure local MongoDB service is started (<code>net start MongoDB</code>). In Atlas, whitelist your server IP address.", table_cell_style)
        ],
    ]
    t_trouble = Table(trouble_data, colWidths=[120, 180, 216])
    t_trouble.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_indigo),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f8fafc')])
    ]))
    story.append(t_trouble)

    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Summary Checklist for Production Go-Live:</b>", h2_style))
    story.append(Paragraph("1. Generate cryptographically strong random keys for <code>JWT_SECRET</code> and <code>ENCRYPTION_SECRET_KEY</code>.", bullet_style))
    story.append(Paragraph("2. Change the Super Administrator initial password immediately after first login.", bullet_style))
    story.append(Paragraph("3. Switch MongoDB URI to an authenticated replica set with TLS and automated daily snapshots.", bullet_style))
    story.append(Paragraph("4. Register permanent System User tokens for Meta WhatsApp and Instagram channels.", bullet_style))
    story.append(Paragraph("5. Register public HTTPS webhook endpoints in Meta App Dashboard and Twilio Console.", bullet_style))
    story.append(Paragraph("6. Validate DNS records (SPF, DKIM, DMARC) for sending email domains.", bullet_style))

    # Build the document with dynamic NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF Successfully generated at: {OUTPUT_PDF}")

if __name__ == "__main__":
    create_manual()
