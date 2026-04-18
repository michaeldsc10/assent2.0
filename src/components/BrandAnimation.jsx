import React, { useState, useEffect } from 'react';
import { Folder, FileText, BarChart, PenTool, Clipboard, Laptop, Book, Presentation, PieChart, Briefcase, Calculator, MonitorSmartphone, Calendar } from 'lucide-react';

const iconsGrid = [
  { Icon: Folder, tx: '-320px', ty: '80px', rotate: '-25deg', delay: '0s' },
  { Icon: FileText, tx: '-260px', ty: '-20px', rotate: '15deg', delay: '0.2s' },
  { Icon: BarChart, tx: '-180px', ty: '-100px', rotate: '-30deg', delay: '0.5s' },
  { Icon: PenTool, tx: '-90px', ty: '-160px', rotate: '45deg', delay: '0.1s' },
  { Icon: Clipboard, tx: '0px', ty: '-190px', rotate: '-10deg', delay: '0.8s' },
  { Icon: Laptop, tx: '90px', ty: '-160px', rotate: '20deg', delay: '0.4s' },
  { Icon: Book, tx: '180px', ty: '-100px', rotate: '-60deg', delay: '0.7s' },
  { Icon: Presentation, tx: '260px', ty: '-20px', rotate: '15deg', delay: '0.3s' },
  { Icon: PieChart, tx: '320px', ty: '80px', rotate: '-40deg', delay: '0.6s' },
  { Icon: Briefcase, tx: '-140px', ty: '20px', rotate: '30deg', delay: '0.9s' },
  { Icon: Calculator, tx: '140px', ty: '20px', rotate: '-20deg', delay: '1.2s' },
  { Icon: MonitorSmartphone, tx: '-60px', ty: '-60px', rotate: '-15deg', delay: '1.3s' },
  { Icon: Calendar, tx: '60px', ty: '-60px', rotate: '35deg', delay: '0.4s' }
];

const BrandAnimation = () => {
  const [isOrganized, setIsOrganized] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  const handleOrganize = () => {
    setIsOrganized(true);
    
    // Logo appears exactly as the Resistance breaks and icons hit center
    setTimeout(() => {
      setShowLogo(true);
    }, 1500);
  };

  return (
    <div className="animation-container">
      {/* Sucking Effect Burst */}
      <div className={`suck-effect ${isOrganized ? 'active' : ''}`}></div>

      {/* Background Side Branding Text */}
      <div className="brand-overlay-text top-left">
        <div className="accent-line"></div>
        <h1 className="main-slogan">
          Gestão<br/>
          que reflete<br/>
          <span className="gold-text">excelência.</span>
        </h1>
        <p className="sub-slogan">SISTEMA DE GESTÃO PROFISSIONAL</p>
      </div>

      <div className="brand-overlay-text bottom-left">
        <div className="accent-border">
          <p>Controle completo do seu negócio.</p>
          <p>Clientes, vendas e produtos</p>
          <p>em um só lugar.</p>
        </div>
      </div>

      {/* Chaotic Icons */}
      {iconsGrid.map((item, index) => {
        const { Icon, tx, ty, rotate, delay } = item;
        return (
          <div
            key={index}
            className={`floating-icon ${isOrganized ? 'sucked' : ''}`}
            style={{
              '--tx': tx,
              '--ty': ty,
              '--rot': rotate,
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${tx}), calc(-50% + ${ty})) scale(1) rotate(${rotate})`,
            }}
          >
            <div className={!isOrganized ? 'idle-float' : ''} style={{ animationDelay: delay }}>
              <Icon size={55} color="#D4AF37" strokeWidth={1} />
            </div>
          </div>
        );
      })}

      {/* Organize Button */}
      <button 
        className={`btn-organize ${isOrganized ? 'hidden' : ''}`}
        onClick={handleOrganize}
      >
        <span style={{ 
          background: 'linear-gradient(45deg, #D4AF37, #B8860B)', 
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Organizar
        </span>
      </button>

      {/* The Brand Logo */}
      <img 
        src="/logo.png" 
        alt="Assent Logo" 
        className={`logo-reveal ${showLogo ? 'visible' : ''}`} 
      />
    </div>
  );
};

export default BrandAnimation;
