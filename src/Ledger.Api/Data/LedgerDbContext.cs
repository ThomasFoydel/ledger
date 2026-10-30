using Ledger.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Data;

public class LedgerDbContext(DbContextOptions<LedgerDbContext> options)
    : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<ProcessedStripeEvent> ProcessedStripeEvents => Set<ProcessedStripeEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<SiteSettings>(entity =>
        {
            entity.HasKey(settings => settings.Id);
            entity.Property(settings => settings.PageTitle).HasMaxLength(200).IsRequired();
            entity.Property(settings => settings.HeaderText).HasMaxLength(200).IsRequired();
            entity.Property(settings => settings.HeroTitle).HasMaxLength(500).IsRequired();
            entity.Property(settings => settings.HeroDescription).HasMaxLength(2000).IsRequired();
            entity.Property(settings => settings.FooterText).HasMaxLength(500).IsRequired();
            entity.Property(settings => settings.LogoUrl).HasMaxLength(500);
            entity.Property(settings => settings.LogoContentType).HasMaxLength(50);
            entity.Property(settings => settings.FaviconUrl).HasMaxLength(500);
            entity.Property(settings => settings.FaviconContentType).HasMaxLength(50);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(order => order.Id);
            entity.Property(order => order.Status).HasMaxLength(40).IsRequired();
            entity.Property(order => order.Currency).HasMaxLength(3).IsRequired();
            entity.Property(order => order.TotalAmount).HasPrecision(12, 2);
            entity.Property(order => order.StripeCheckoutSessionId).HasMaxLength(255);
            entity.Property(order => order.CustomerEmail).HasMaxLength(320);
            entity.Property(order => order.UserId).HasMaxLength(450);
            entity.HasIndex(order => order.StripeCheckoutSessionId).IsUnique();
            entity.HasIndex(order => order.UserId);

            entity.HasOne<IdentityUser>()
                .WithMany()
                .HasForeignKey(order => order.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(order => order.Items)
                .WithOne(item => item.Order)
                .HasForeignKey(item => item.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ProductName).HasMaxLength(200).IsRequired();
            entity.Property(item => item.UnitPrice).HasPrecision(10, 2);
            entity.HasIndex(item => item.OrderId);
        });

        modelBuilder.Entity<ProcessedStripeEvent>(entity =>
        {
            entity.HasKey(item => item.EventId);
            entity.Property(item => item.EventId).HasMaxLength(255);
            entity.Property(item => item.Type).HasMaxLength(255).IsRequired();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(product => product.Id);
            entity.Property(product => product.Name).HasMaxLength(200).IsRequired();
            entity.Property(product => product.Description).HasMaxLength(2000);
            entity.Property(product => product.Price).HasPrecision(10, 2);

            entity.ToTable(table =>
                table.HasCheckConstraint(
                    "CK_Products_QuantityOnHand_NonNegative",
                    "\"QuantityOnHand\" >= 0"));
        });
    }
}
