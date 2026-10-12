using Ledger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Data;

public class LedgerDbContext(DbContextOptions<LedgerDbContext> options)
  : DbContext(options)
{
  public DbSet<Product> Products => Set<Product>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.Entity<Product>(entity =>
    {
      entity.HasKey(product => product.Id);
      entity.Property(product => product.Name).HasMaxLength(200).IsRequired();
      entity.Property(product => product.Description).HasMaxLength(2000);
      entity.Property(product => product.Price).HasPrecision(10, 2);
    });
  }
}
